import requests




def better_get(url:str) -> requests.Response:
    for _ in range(5):
        try:
            with requests.get(url) as response:
                if response.status_code == 200:
                    return response
                else:
                    raise Exception()
        except:
            print(f"[Error] Failed to connect to the database [{response.status_code}]")
            return None




def better_post(url:str, payload, headers) -> requests.Response:
    try:
        with requests.post(url, data=payload, headers=headers) as response:
            if response.status_code == 200:
                return response
            else:
                raise Exception()
    except: 
        print(f"[Error] Failed to connect to the database [{response.status_code}]")
        return None