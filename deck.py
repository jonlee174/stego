import json
import os

class Deck:
    def __init__(self, name, description):
        self.name = name
        self.description = description
        self.card_list = []

    def __repr__(self):
        return f"{self.name} is a deck with {str(len(self.card_list))} cards."

    def edit_name(self, new_name):
        self.name = new_name

    def edit_description(self, new_descr):
        self.description = new_descr

    def add_deck(self):
        data = json.loads('''{"name": "''' + self.name + '''", "description": "''' + self.description + '''", "deck": []}''')
        with open(os.path.join("data", "decks.json"), "r+") as file:
            file_data = json.load(file)
            d_names = [file_data["decks"][i]["name"] for i, item in enumerate(file_data["decks"])]
            if data not in file_data["decks"]:
                if self.name not in d_names:
                    file_data["decks"].append(data)
                    file.seek(0)

        with open(os.path.join("data", "decks.json"), "w", encoding="utf-8") as file:
            file.write(json.dumps(file_data, indent=4))

    def remove_deck(self):
        with open(os.path.join("data", "decks.json"), "r+") as file:
            file_data = json.load(file)
            d_names = [file_data["decks"][i]["name"] for i, item in enumerate(file_data["decks"])]
            if self.name in d_names:
                for item in file_data["decks"]:
                    if self.name == item["name"]:
                        file_data["decks"].remove(item)
                file.seek(0)

        with open(os.path.join("data", "decks.json"), "w", encoding="utf-8") as file:
            file.write(json.dumps(file_data, indent=4))