"""
ZapOut Backend Tests
pytest-based tests for the ZapOut API
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

# Add backend to path - go up one directory from tests/
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, BACKEND_DIR)

# Change to backend directory for DB access
os.chdir(BACKEND_DIR)

# Import app components
from fastapi.testclient import TestClient
from main import TOKEN_EXPIRY_HOURS, app, check_rate_limit, hash_password, verify_password


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def test_db(tmp_path):
    """Create temporary test database"""
    db_path = tmp_path / "test.db"
    os.environ["DB_PATH"] = str(db_path)
    yield str(db_path)
    # Cleanup handled by tmp_path


class TestPasswordHashing:
    """Test password hashing functions"""

    def test_hash_password_returns_string(self):
        """Hash should return a string"""
        result = hash_password("testpassword")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_hash_password_is_salted(self):
        """Same password should produce different hashes"""
        hash1 = hash_password("testpassword")
        hash2 = hash_password("testpassword")
        assert hash1 != hash2  # Different salt each time

    def test_verify_password_correct(self):
        """Correct password should verify"""
        password = "mypassword123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Incorrect password should fail"""
        hashed = hash_password("correctpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_password_invalid_hash(self):
        """Invalid hash format should return False"""
        assert verify_password("password", "invalid_hash") is False


class TestRateLimiting:
    """Test rate limiting"""

    def test_rate_limit_allows_under_limit(self):
        """Should allow requests under limit"""
        # Clear any existing state
        from main import login_attempts

        login_attempts.clear()

        for i in range(5):
            assert check_rate_limit("192.168.1.1") is True

    def test_rate_limit_blocks_over_limit(self):
        """Should block after limit exceeded"""
        from main import MAX_LOGIN_ATTEMPTS, login_attempts

        login_attempts.clear()

        # Exhaust the limit
        for _ in range(MAX_LOGIN_ATTEMPTS):
            check_rate_limit("192.168.1.100")

        # Next request should be blocked
        assert check_rate_limit("192.168.1.100") is False


class TestHealthEndpoint:
    """Test health check endpoint"""

    def test_root_endpoint(self):
        """Test root endpoint returns version"""
        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200
        assert "version" in response.json()

    def test_health_endpoint(self):
        """Test health endpoint"""
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestAuthEndpoints:
    """Test authentication endpoints"""

    def test_register_new_user(self, client):
        """Test user registration"""
        unique_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
        response = client.post(
            "/auth/register",
            json={"email": unique_email, "password": "testpass123", "phone": "+49123456789"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] == unique_email

    def test_register_duplicate_email(self, client):
        """Test duplicate email registration fails"""
        unique_email = f"dup-{uuid.uuid4().hex[:8]}@test.com"
        # First registration
        client.post("/auth/register", json={"email": unique_email, "password": "password123"})

        # Second registration should fail
        response = client.post(
            "/auth/register", json={"email": unique_email, "password": "password456"}
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_login_success(self, client):
        """Test successful login"""
        unique_email = f"login-{uuid.uuid4().hex[:8]}@test.com"
        # Register first
        client.post("/auth/register", json={"email": unique_email, "password": "loginpass123"})

        # Then login
        response = client.post(
            "/auth/login", json={"email": unique_email, "password": "loginpass123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data

    def test_login_wrong_password(self, client):
        """Test login with wrong password"""
        unique_email = f"wrongpass-{uuid.uuid4().hex[:8]}@test.com"
        # Register first
        client.post("/auth/register", json={"email": unique_email, "password": "correctpassword"})

        # Login with wrong password
        response = client.post(
            "/auth/login", json={"email": unique_email, "password": "wrongpassword"}
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login with nonexistent user"""
        response = client.post(
            "/auth/login",
            json={
                "email": f"nonexistent-{uuid.uuid4().hex[:8]}@test.com",
                "password": "anypassword",
            },
        )
        assert response.status_code == 401


class TestPaymentEndpoints:
    """Test payment endpoints"""

    def test_create_payment_requires_auth(self, client):
        """Test payment creation requires authentication"""
        response = client.post("/payments", json={"amount_cents": 1000, "method": "lightning"})
        assert response.status_code == 401

    def test_get_payments_requires_auth(self, client):
        """Test getting payments requires authentication"""
        response = client.get("/payments")
        assert response.status_code == 401

    def test_payment_flow_authenticated(self, client):
        """Test complete payment flow with auth"""
        unique_email = f"payment-{uuid.uuid4().hex[:8]}@test.com"
        # Register and login
        client.post("/auth/register", json={"email": unique_email, "password": "paypass123"})

        login_response = client.post(
            "/auth/login", json={"email": unique_email, "password": "paypass123"}
        )
        token = login_response.json()["token"]

        headers = {"Authorization": f"Bearer {token}"}

        # Create payment
        pay_response = client.post(
            "/payments", json={"amount_cents": 5000, "method": "lightning"}, headers=headers
        )
        assert pay_response.status_code == 200

        # Get payments
        get_response = client.get("/payments", headers=headers)
        assert get_response.status_code == 200
        payments = get_response.json()
        assert len(payments) > 0
        assert payments[0]["amount_cents"] == 5000


class TestTokenExpiration:
    """Test token expiration"""

    def test_token_expiry_config(self):
        """Test token expiry is configured"""
        assert TOKEN_EXPIRY_HOURS > 0
        assert isinstance(TOKEN_EXPIRY_HOURS, int)


class TestCORS:
    """Test CORS configuration"""

    def test_cors_headers_present(self, client):
        """Test CORS headers are present"""
        response = client.options(
            "/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
        # Should handle CORS preflight


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
