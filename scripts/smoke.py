#!/usr/bin/env python3
"""End-to-end smoke test against a running Bainsla Voice instance using the MOCK provider only.

Usage: BV_URL=http://localhost:3540 BV_EMAIL=... BV_PASSWORD=... python3 scripts/smoke.py
Never point this at an organisation configured with a real telephony provider.
"""
import io, json, os, subprocess, sys, tempfile, time, uuid
import requests

URL = os.environ.get("BV_URL", "http://localhost:3540").rstrip("/")
s = requests.Session()
s.headers["Origin"] = URL
ok_count = 0


def check(cond, msg):
    global ok_count
    if not cond:
        print("FAIL:", msg)
        sys.exit(1)
    ok_count += 1
    print("ok  ", msg)


def api(method, path, **kw):
    r = s.request(method, URL + path, timeout=120, **kw)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


st, b = api("POST", "/api/auth/login", json={"email": os.environ["BV_EMAIL"], "password": os.environ["BV_PASSWORD"]})
check(st == 200 and b.get("ok"), f"login {st}")

st, b = api("GET", "/api/health")
check(st == 200 and b.get("db") == "ok" and b.get("redis") == "ok", f"health {b}")

st, b = api("POST", "/api/emergency", json={"on": False})
st, b = api("POST", "/api/caller-ids/sync")
check(st == 200, f"caller id sync {b}")

# Unverified caller ID request stays pending
st, b = api("POST", "/api/caller-ids", json={"phone": "+919999000111", "label": "Smoke unverified " + uuid.uuid4().hex[:4]})
check(st in (200, 409), f"request caller id {st}")

# Settings / purposes come from pages; use internal list endpoint via a page-less query
st, meta = api("GET", "/api/smoke-meta")
check(st == 200, f"meta {st} {meta if st != 200 else ''}")
promo = next(p for p in meta["purposes"] if p["category"] == "PROMOTIONAL")
verified = [c for c in meta["callerIds"] if c["verificationStatus"] == "VERIFIED"]
pending = [c for c in meta["callerIds"] if c["verificationStatus"] == "PENDING"]
check(len(verified) >= 1, "verified caller id exists")
cid = verified[0]["id"]
st, b = api("PATCH", f"/api/caller-ids/{cid}", json={"approvedCategories": ["TRANSACTIONAL", "SERVICE", "PROMOTIONAL"]})
check(st == 200, "approve caller id categories")

# Audio
with tempfile.TemporaryDirectory() as d:
    wav = os.path.join(d, "t.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", wav], check=True)
    st, b = api("POST", "/api/audio", data={"name": "Smoke test tone"}, files={"file": ("tone.wav", open(wav, "rb"), "audio/wav")})
    check(st == 200 and b.get("durationSeconds", 0) >= 3, f"audio upload {st} {b if st != 200 else ''}")
    aid = b["id"]
    txt = os.path.join(d, "fake.mp3")
    open(txt, "w").write("not audio at all")
    st, b = api("POST", "/api/audio", data={"name": "Fake"}, files={"file": ("fake.mp3", open(txt, "rb"), "audio/mpeg")})
    check(st == 400, f"fake audio rejected: {b}")
st, b = api("POST", f"/api/audio/{aid}", json={"action": "approve"})
check(st == 200, "audio approved")

# Import: last digit drives mock outcome. 4,5,6,7,8 complete; 0 no-answer; 1 busy; 2 transient; 3 invalid; 9 opt-out.
tag = "smoke" + uuid.uuid4().hex[:5]
base = 70000 + int(time.time()) % 9000
nums = [f"98{base:05d}{i:03d}" for i in range(10)]
csv = "Mobile Number,Name,Consent Source,Consent Date,Evidence\n"
for i, n in enumerate(nums):
    csv += f"{n},Person {i},Smoke signup form,01/10/2026,SMOKE-{i}\n"
csv += f"{nums[4]},Dup,Smoke signup form,01/10/2026,SMOKE-dup\n"
csv += "12345,Bad,Smoke,01/10/2026,X\n"
csv += f"98{base:05d}777,No evidence,Smoke,01/10/2026,\n"
csv += "=HYPERLINK(\"x\"),Formula,Smoke,01/10/2026,X\n"
st, b = api("POST", "/api/contacts/import", data={"purposeId": promo["id"], "attest": "yes", "tags": tag}, files={"file": ("smoke.csv", io.BytesIO(csv.encode()), "text/csv")})
check(st == 200, f"import {st} {b if st != 200 else ''}")
check(b["created"] + b["updated"] == 10 and b["duplicates"] == 1 and b["rejected"] == 3, f"import counts {b}")
st, b = api("POST", "/api/contacts/import", data={"purposeId": promo["id"], "tags": tag}, files={"file": ("smoke.csv", io.BytesIO(csv.encode()), "text/csv")})
check(st == 400, "import without attestation rejected")

# Campaign with an unverified caller ID cannot be submitted
camp = {
    "name": "Smoke " + tag, "purposeId": promo["id"], "audioAssetId": aid, "callerIdId": cid, "segmentTags": [tag],
    "windowStart": "00:00", "windowEnd": "23:59", "dailyCap": 1000, "concurrency": 5,
    "consentBasis": "Smoke signup form opt-in", "optOutMethod": "Press 9 or visit /opt-out", "attested": True,
}
if pending:
    st, b = api("POST", "/api/campaigns", json={**camp, "callerIdId": pending[0]["id"]})
    st, b2 = api("POST", f"/api/campaigns/{b['id']}/action", json={"action": "submit"})
    check(st == 400 and "caller" in b2["error"].lower(), f"unverified caller blocked: {b2}")
    api("POST", f"/api/campaigns/{b['id']}/action", json={"action": "cancel"})

st, b = api("POST", "/api/campaigns", json=camp)
check(st == 200, f"campaign created {b if st != 200 else ''}")
camp_id = b["id"]
for a in ["submit", "approve", "start"]:
    st, b = api("POST", f"/api/campaigns/{camp_id}/action", json={"action": a})
    check(st == 200, f"campaign {a} {b}")

deadline = time.time() + 240
while time.time() < deadline:
    st, b = api("GET", f"/api/campaigns/{camp_id}")
    if b["status"] in ("COMPLETED", "PAUSED", "FAILED"):
        break
    c = b["counts"]
    if b["inflight"] == 0 and not c.get("QUEUED") and not c.get("IN_PROGRESS") and c.get("PENDING", 0) <= 1 and c.get("COMPLETED", 0) >= 6:
        break  # only the transient-failure retry is waiting for its backoff
    time.sleep(3)
print("   ", b)
check(b["status"] in ("COMPLETED", "RUNNING"), f"campaign settled ({b['status']}, retry pending only)")
counts = b["counts"]
check(counts.get("COMPLETED", 0) >= 6, "answered + opt-out recipients completed")

# Opt-out: the ...9 number must now be suppressed; a second campaign to the same tag must skip it
st, meta = api("GET", "/api/smoke-meta?tag=" + tag)
check(meta["suppressedInTag"] >= 1, "DTMF 9 opt-out suppressed the number")

# Duplicate / tampered webhooks
st, b = s.post(URL + "/api/webhooks/telephony/mock", data=b"{}", headers={"x-bv-timestamp": str(int(time.time())), "x-bv-signature": "00"}).status_code, None
check(st == 401, "unsigned webhook rejected")

# Single call idempotency
contact = meta["contactInTag"]
key = uuid.uuid4().hex
body = {"contactId": contact, "purposeId": promo["id"], "callerIdId": cid, "audioAssetId": aid, "idempotencyKey": key}
st, b1 = api("POST", "/api/calls", json=body)
st2, b2 = api("POST", "/api/calls", json=body)
if st == 200:
    check(b2.get("replay") and b1["attemptId"] == b2["attemptId"], "single call idempotent")
else:
    check("cap" in b1["error"].lower() or "called" in b1["error"].lower(), f"single call blocked by contact cap: {b1}")

# CSV export formula safety
r = s.get(URL + "/api/calls/export")
check(r.status_code == 200 and "\n=" not in r.text and ",=" not in r.text, "call export ok and formula-safe")

# Emergency stop
st, b = api("POST", "/api/emergency", json={"on": True})
check(st == 200, "emergency stop on")
st, b = api("POST", "/api/calls", json={**body, "idempotencyKey": uuid.uuid4().hex})
check(st == 400, f"calls blocked during emergency stop: {b}")
api("POST", "/api/emergency", json={"on": False})

# Cross-site POST blocked
r = requests.post(URL + "/api/emergency", json={"on": True}, headers={"Origin": "https://evil.example"}, cookies=s.cookies)
check(r.status_code == 403, "cross-site request blocked")

print(f"\nALL {ok_count} CHECKS PASSED")
