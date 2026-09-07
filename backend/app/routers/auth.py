from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..auth import (
    clear_session_cookie,
    create_session,
    delete_session,
    get_current_user,
    get_session_id,
    set_session_cookie,
    verify_password,
)
from ..database import get_db
from ..models import User
from ..schemas import AuthResponse, LoginRequest, MessageResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    session_id = create_session(db, user)
    set_session_cookie(response, session_id)
    return AuthResponse(user=UserResponse.model_validate(user), session_id=session_id)


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = get_session_id(request)
    if session_id:
        delete_session(db, session_id)
    clear_session_cookie(response)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)
