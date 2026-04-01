from utilities.util_network import better_get




def check_live_status(channel:str):
    url = f'https://www.twitch.tv/{channel}'
    contents = better_get(url).content.decode('utf-8')
    if 'isLiveBroadcast' in contents:
        return True
    else:
        return False


