import json
import os

class Card:
    def __init__(self, info_front, info_back):
        self.info_front = info_front
        self.info_back = info_back

    def edit_front(self, new_info):
        self.info_front = new_info

    def edit_back(self, new_info):
        self.info_back = new_info

    def flip(self):
        temp = self.info_front
        self.info_front = self.info_back
        self.info_back = temp

    def add_to_deck(self, deck_obj):
        data = json.loads('''{"info_front": "''' + self.info_front + '''" ,"info_back": "''' + self.info_back + '''"}''')
        with open(os.path.join("data", "decks.json"), "r+") as file:
            file_data = json.load(file)
            for i in range(len(file_data["decks"])):
                if file_data["decks"][i]["name"] == deck_obj.name and data not in file_data["decks"][i]["deck"]:
                    file_data["decks"][i]["deck"].append(data)
                    file.seek(0)
                    json.dump(file_data, file, indent=4)
        deck_obj.card_list.append(self)

    def remove_card_from_deck(self, deck_obj):
        data = json.loads('''{"info_front": "''' + self.info_front + '''" ,"info_back": "''' + self.info_back + '''"}''')
        with open(os.path.join("data", "decks.json"), "r+") as file:
            file_data = json.load(file)
            for i, item in enumerate(file_data["decks"]):
                if item["name"] == deck_obj.name and data in item["deck"]:
                    file_data["decks"][i]["deck"].remove(data)
                    file.seek(0)

        with open(os.path.join("data", "decks.json"), "w", encoding='utf-8') as file:
            file.write(json.dumps(file_data, indent=4))
        deck_obj.card_list.remove(self)