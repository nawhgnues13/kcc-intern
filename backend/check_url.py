import urllib.request
import urllib.error

url = "https://kcc-intern-profile-images.s3.us-east-2.amazonaws.com/newsletter-assets/sale-b57cb4b8-18d9-47fd-adbe-dfa7ac316e33/4eaa7836-3c3e-4030-82b0-d257f84f94c9.jpg"
try:
    req = urllib.request.Request(url, method="HEAD")
    resp = urllib.request.urlopen(req)
    print("Success! status:", resp.status)
    for k, v in resp.getheaders():
        print(f"{k}: {v}")
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
