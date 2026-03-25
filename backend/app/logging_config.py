"""
ZapOut Logging Configuration - Structured JSON Logging
Following fullstack-dev: Structured JSON logging with request ID propagation
"""

import logging
import sys
import uuid
from contextvars import ContextVar
from functools import wraps
from typing import Any, Callable, Dict, Optional

from fastapi import Request

# Context variable for request ID (thread-safe for async)
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Get current request ID from context"""
    return request_id_ctx.get()


def set_request_id(request_id: str) -> None:
    """Set request ID in context"""
    request_id_ctx.set(request_id)


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add request ID if available
        if request_id_ctx.get():
            log_data["request_id"] = request_id_ctx.get()

        # Add extra fields
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)

        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Build message string for console output
        parts = [f"[{log_data['level']}] {log_data['logger']}: {log_data['message']}"]
        if log_data.get("request_id"):
            parts.append(f"(req_id={log_data['request_id']})")

        # Add extra fields to message for readability
        for key, value in log_data.items():
            if key not in ["timestamp", "level", "logger", "message", "request_id", "exception"]:
                parts.append(f"{key}={value}")

        return " ".join(parts)


def setup_logging(debug: bool = False) -> None:
    """Configure structured logging for the application"""

    # Create JSON formatter
    json_formatter = StructuredFormatter()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(json_formatter)

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)
    root_logger.addHandler(console_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


class RequestContextLogger:
    """Context manager for request-scoped logging with request ID"""

    def __init__(self, request_id: Optional[str] = None):
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self.old_value = None

    def __enter__(self) -> str:
        self.old_value = request_id_ctx.set(self.request_id)
        return self.request_id

    def __exit__(self, exc_type, exc_val, exc_tb):
        request_id_ctx.reset(self.old_value)
        return False


def log_with_context(
    logger: logging.Logger,
    level: str,
    message: str,
    extra_fields: Optional[Dict[str, Any]] = None,
    exc_info: bool = False,
) -> None:
    """Log with request context and extra fields"""

    log_data = {
        "extra_fields": extra_fields or {},
    }

    log_func = getattr(logger, level.lower(), logger.info)
    log_func(message, extra=log_data, exc_info=exc_info)


# Decorator to add request ID to function calls
def with_request_context(func: Callable) -> Callable:
    """Decorator to ensure request context is available in a function"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        ctx = RequestContextLogger()
        with ctx:
            return func(*args, **kwargs)

    return wrapper
