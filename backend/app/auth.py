import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Session as SessionModel
from .models import User

SESSION_COOKIE = "route53_session"
SESSION_DURATION_DAYS = 7

MOCK_USERS = [
    {
        "username": "admin",
        "password": "admin123",
        "display_name": "Route53 Admin",
        "account_id": "123456789012",
    },
    {
        "username": "demo",
        "password": "demo123",
        "display_name": "Demo User",
        "account_id": "987654321098",
    },
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def seed_users(db: Session) -> None:
    for user_data in MOCK_USERS:
        existing = db.query(User).filter(User.username == user_data["username"]).first()
        if not existing:
            db.add(
                User(
                    username=user_data["username"],
                    password_hash=hash_password(user_data["password"]),
                    display_name=user_data["display_name"],
                    account_id=user_data["account_id"],
                )
            )
    db.commit()


def create_session(db: Session, user: User) -> str:
    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    db.add(SessionModel(id=session_id, user_id=user.id, expires_at=expires_at))
    db.commit()
    return session_id


def delete_session(db: Session, session_id: str) -> None:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session:
        db.delete(session)
        db.commit()


def get_session_id(request: Request) -> Optional[str]:
    return request.cookies.get(SESSION_COOKIE)


def set_session_cookie(response, session_id: str) -> None:
    secure = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_id,
        httponly=True,
        max_age=SESSION_DURATION_DAYS * 24 * 3600,
        samesite="none" if secure else "lax",
        secure=secure,
        path="/",
    )


def clear_session_cookie(response) -> None:
    secure = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="none" if secure else "lax",
        secure=secure,
    )


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    session_id = get_session_id(request)
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def get_optional_user(
    request: Request, db: Session = Depends(get_db)
) -> Optional[User]:
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None
