"""
ZapOut Error Hierarchy - Typed Error Classes
Following fullstack-dev: Every error is typed, logged, and returns consistent format
"""

from typing import Any, Dict, List, Optional


class AppError(Exception):
    """Base application error with typed hierarchy"""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to API response format"""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "status": self.status_code,
                "details": self.details,
            }
        }


class ValidationError(AppError):
    """Input validation failed"""

    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: Optional[List[Dict[str, str]]] = None,
    ):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details={"field_errors": field_errors or []},
        )
        self.field_errors = field_errors or []


class NotFoundError(AppError):
    """Resource not found"""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )
        self.resource = resource
        self.identifier = identifier


class AuthenticationError(AppError):
    """Authentication failed"""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401,
        )


class AuthorizationError(AppError):
    """User not authorized for this action"""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code="AUTHORIZATION_ERROR",
            status_code=403,
        )


class ConflictError(AppError):
    """Resource conflict (e.g., duplicate)"""

    def __init__(self, message: str, resource: Optional[str] = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
            details={"resource": resource} if resource else {},
        )


class RateLimitError(AppError):
    """Rate limit exceeded"""

    def __init__(
        self,
        message: str = "Too many requests",
        retry_after: Optional[int] = None,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": retry_after} if retry_after else {},
        )


class ExternalServiceError(AppError):
    """External service (LND, Cashu, etc.) failed"""

    def __init__(self, service: str, message: str, original_error: Optional[str] = None):
        super().__init__(
            message=f"{service} error: {message}",
            code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details={
                "service": service,
                "original_error": original_error,
            },
        )
        self.service = service
        self.original_error = original_error


class DatabaseError(AppError):
    """Database operation failed"""

    def __init__(self, message: str, operation: Optional[str] = None):
        super().__init__(
            message=f"Database error: {message}",
            code="DATABASE_ERROR",
            status_code=500,
            details={"operation": operation} if operation else {},
        )
