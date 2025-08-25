from datetime import datetime
import pytz

def get_current_ist_time() -> datetime:
    """
    Returns the current time as a timezone-aware datetime object for IST.
    """

    # Define the Indian Standard Time timezone
    IST = pytz.timezone('Asia/Kolkata')
    
    # Get the current time and localize it to IST
    return datetime.now(IST)