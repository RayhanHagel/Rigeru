from arq.connections import RedisSettings

async def sample_heavy_task(ctx, task_data):
    return {"status": "success", "data": task_data}

class WorkerSettings:
    redis_settings = RedisSettings(
        host='localhost', 
        port=6379, 
        password='phoenix'
    )
    # Register the functions this worker is allowed to run
    functions = [sample_heavy_task]