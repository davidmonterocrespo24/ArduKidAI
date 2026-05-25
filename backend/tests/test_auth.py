import pytest

from app.auth import users


@pytest.fixture(autouse=True)
def _reset_users():
    users.reset()
    yield
    users.reset()


def test_signup_and_signin_round_trip(client):
    res = client.post(
        "/api/auth/signup",
        json={"email": "kid@example.com", "password": "strong-pw-1"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "kid@example.com"
    assert body["token"]

    token = body["token"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "kid@example.com"

    signin = client.post(
        "/api/auth/signin",
        json={"email": "kid@example.com", "password": "strong-pw-1"},
    )
    assert signin.status_code == 200


def test_signup_rejects_short_password(client):
    res = client.post(
        "/api/auth/signup",
        json={"email": "kid@example.com", "password": "short"},
    )
    assert res.status_code == 422


def test_signup_rejects_duplicate_email(client):
    client.post(
        "/api/auth/signup",
        json={"email": "kid@example.com", "password": "valid-password-1"},
    )
    res = client.post(
        "/api/auth/signup",
        json={"email": "kid@example.com", "password": "valid-password-2"},
    )
    assert res.status_code == 400
    assert "already" in res.json()["detail"]


def test_signin_wrong_password_returns_401(client):
    client.post(
        "/api/auth/signup",
        json={"email": "kid@example.com", "password": "valid-password-1"},
    )
    res = client.post(
        "/api/auth/signin",
        json={"email": "kid@example.com", "password": "wrong-password"},
    )
    assert res.status_code == 401


def test_me_without_token_returns_null(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json() is None


def test_projects_are_scoped_to_user(client):
    signup = client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "password": "valid-pass-1"},
    )
    token_alice = signup.json()["token"]

    signup2 = client.post(
        "/api/auth/signup",
        json={"email": "bob@example.com", "password": "valid-pass-2"},
    )
    token_bob = signup2.json()["token"]

    body = {
        "name": "alice-blink",
        "circuit": {
            "components": [],
            "wires": [],
            "blockly_xml": "<xml/>",
            "cpp_code": "",
        },
    }
    res = client.post(
        "/api/projects",
        json=body,
        headers={"Authorization": f"Bearer {token_alice}"},
    )
    assert res.status_code == 200
    alice_proj = res.json()

    # Alice sees her project.
    alice_list = client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {token_alice}"},
    ).json()
    assert any(p["id"] == alice_proj["id"] for p in alice_list)

    # Bob does not.
    bob_list = client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {token_bob}"},
    ).json()
    assert all(p["id"] != alice_proj["id"] for p in bob_list)

    # Anonymous does not either.
    anon_list = client.get("/api/projects").json()
    assert all(p["id"] != alice_proj["id"] for p in anon_list)


def test_anonymous_project_is_isolated_from_users(client):
    body = {
        "name": "anon-blink",
        "circuit": {
            "components": [],
            "wires": [],
            "blockly_xml": "<xml/>",
            "cpp_code": "",
        },
    }
    saved = client.post("/api/projects", json=body).json()

    signup = client.post(
        "/api/auth/signup",
        json={"email": "newuser@example.com", "password": "valid-pass-1"},
    )
    token = signup.json()["token"]
    user_list = client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert all(p["id"] != saved["id"] for p in user_list)
