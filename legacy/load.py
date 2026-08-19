import json
import os
from card import Card
from deck import Deck

def load_decks():
    with open(os.path.join("data", "decks.json"), "r+") as file:
        deck_data = json.load(file)
        deck_list = []
        for i in range(len(deck_data["decks"])):
            deck = Deck(deck_data["decks"][i]["name"], deck_data["decks"][i]["description"])
            for k in range(len(deck_data["decks"][i]["deck"])):
                deck.card_list.append(Card(deck_data["decks"][i]["deck"][k]["info_front"], deck_data["decks"][i]["deck"][k]["info_back"]))
            deck_list.append(deck)
    return deck_list