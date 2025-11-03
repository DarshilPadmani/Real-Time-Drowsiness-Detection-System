from app import app

app.testing = True

with app.test_client() as c:
    resp = c.get('/dashboard')
    print('STATUS:', resp.status_code)
    print(resp.data.decode('utf-8')[:500])



