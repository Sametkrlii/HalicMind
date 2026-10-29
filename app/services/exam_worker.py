"""Application-owned polling: active only while the backend is running."""
import asyncio
import logging
from app.core.config import settings
from app.services.exam_sync import run_sync

logger=logging.getLogger(__name__)


async def poll(stop):
    while not stop.is_set():
        try:
            await asyncio.to_thread(run_sync)
        except Exception:
            # No source bodies, cookies, credentials or user data in logs.
            logger.warning('Exam source check failed; verify database migrations and connectivity.')
        try:
            await asyncio.wait_for(stop.wait(),timeout=settings.exam_sync_interval_seconds)
        except TimeoutError:
            pass
