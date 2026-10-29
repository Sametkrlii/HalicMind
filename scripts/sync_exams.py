"""Manual maintenance run; same lock and source rules as the background worker."""
import argparse
from app.services.exam_sync import run_sync

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--force',action='store_true',help='Ignore interval; do not bypass the process lock.')
    args=parser.parse_args()
    print(run_sync(force=args.force))
