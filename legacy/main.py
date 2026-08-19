from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.core.window import Window
from kivy.core.text import LabelBase
from kivy.uix.label import Label
from kivy.uix.image import Image
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.uix.carousel import Carousel
from card import Card
from deck import Deck
from load import load_decks
import pyuac
import sys
import os

LabelBase.register(name="African", fn_regular=os.path.join("assets", os.path.join("fonts", "african.ttf")))
LabelBase.register(name="Future", fn_regular=os.path.join("assets", os.path.join("fonts", "future.ttf")))
LabelBase.register(name="Rockwell", fn_regular=os.path.join("assets", os.path.join("fonts", "rockwell.ttf")))

Window.clearcolor = (0.8008, 0.8008, 0.7031, 1)
Window.maximize()
current = Deck("", "")
try:
    current = load_decks()[0]
except:
    pass
def get_current():
    return current

def set_current(new_value):
    global current
    current = new_value

class Grid(GridLayout):
    def __init__(self, **kwargs):
        super(Grid, self).__init__(**kwargs)
        self.size_hint_x = 0.75
        self.size_hint_y = None
        self.cols = 1
        self.size = (Window.width, Window.height)
        self.row_default_height = 50
        self.row_force_deafult = True

        self.title_input = TextInput(
            multiline=False,
            font_name="Rockwell",
            size_hint=(0.5, 0.05),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))

        self.descr_input = TextInput(
            multiline=True,
            font_name="Rockwell",
            size_hint=(0.5, 0.15),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))

        self.front_input = TextInput(
            multiline=True,
            font_name="Rockwell",
            size_hint=(0.5, 0.05),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))

        self.back_input = TextInput(
            multiline=True,
            font_name="Rockwell",
            size_hint=(0.5, 0.05),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))

        self.front_inputs = [self.front_input]
        self.back_inputs = [self.back_input]
        self.grid_children = [
            Label(
                text="Title",
                font_name="Future",
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.title_input,
            Label(
                text="Description",
                font_name="Future",
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.descr_input,
            Label(
                text="Card #1",
                font_name="Future",
                font_size=10,
                size_hint=(None, 0),
                color=(0.2109, 0.3711, 0.2344, 1)),
            Label(
                text="Front",
                font_name="Future",
                font_size=10,
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.front_input,
            Label(
                text="Back",
                font_name="Future",
                font_size=10,
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.back_input
                ]

        for child in self.grid_children:
            self.add_widget(child)
        
class Scroll(ScrollView):
    def __init__(self, **kwargs):
        super(Scroll, self).__init__(**kwargs)

        self.scroll_type = ['bars', 'content']
        self.scroll_wheel_distance = 40
        self.pos_hint = {"x": 0.1, "y": 0}
        self.do_scroll_x = False
        self.do_scroll_y = True
        self.size = (Window.width, Window.height)
        self.size_hint = (1, 1)

        self.grid = Grid()
        self.grid.bind(minimum_height=self.grid.setter('height'))
        self.add_widget(self.grid)

class MainWindow(Screen):
    def __init__(self, **kwargs):
        super(MainWindow, self).__init__(**kwargs)

        self.name = "main"

        self.add_widget(Image(source=os.path.join("assets", os.path.join("images", "stego.png")),
            keep_ratio=True,
            size_hint=(0.2, 0.2),
            pos_hint={"x": 0.825}))

        self.add_widget(Image(source=os.path.join("assets", os.path.join("images", "title.png")),
            keep_ratio=True,
            size_hint=(0.5, 0.5),
            pos_hint={"x": 0.25, "top": 1}))

class CreateWindow(Screen):
    def __init__(self, **kwargs):
        super(CreateWindow, self).__init__(**kwargs)
        self.name = "create"
        self.scroll = Scroll()
        self.add_widget(self.scroll)
        self.num_added = 2

    def create_button(self):
        if self.scroll.grid.title_input.text != "":
            current_deck = Deck(self.scroll.grid.title_input.text, self.scroll.grid.descr_input.text)
            current_deck.add_deck()
            for i, front in enumerate(self.scroll.grid.front_inputs):
                if front.text != "":
                    current_card = Card(front.text, self.scroll.grid.back_inputs[i].text)
                    current_card.add_to_deck(current_deck)
                    front.text = ""
                    self.scroll.grid.back_inputs[i].text = ""
        self.scroll.grid.title_input.text = ""
        self.scroll.grid.descr_input.text = ""

        self.scroll.grid.front_inputs = [self.scroll.grid.front_input]
        self.scroll.grid.back_inputs = [self.scroll.grid.back_input]
        self.scroll.grid.grid_children = [
            Label(
                text="Title",
                font_name="Future",
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.scroll.grid.title_input,
            Label(
                text="Description",
                font_name="Future",
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.scroll.grid.descr_input,
            Label(
                text="Card #1",
                font_name="Future",
                font_size=10,
                size_hint=(None, 0),
                color=(0.2109, 0.3711, 0.2344, 1)),
            Label(
                text="Front",
                font_name="Future",
                font_size=10,
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.scroll.grid.front_input,
            Label(
                text="Back",
                font_name="Future",
                font_size=10,
                color=(0.2109, 0.3711, 0.2344, 1)),
            self.scroll.grid.back_input
                ]

    def add_button(self):
        self.scroll.grid.add_widget(Label(
            text=f"Card #{self.num_added}",
            font_name="Future",
            font_size=10,
            size_hint=(None, 0),
            color=(0.2109, 0.3711, 0.2344, 1)))

        self.scroll.grid.add_widget(Label(
            text="Front",
            font_name="Future",
            font_size=10,
            color=(0.2109, 0.3711, 0.2344, 1)))

        self.scroll.grid.next_front_input = TextInput(
            multiline=True,
            font_name="Rockwell",
            size_hint=(0.5, 0.05),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))
        self.scroll.grid.add_widget(self.scroll.grid.next_front_input)
        self.scroll.grid.front_inputs.append(self.scroll.grid.next_front_input)

        self.scroll.grid.add_widget(Label(
            text="Back",
            font_name="Future",
            font_size=10,
            color=(0.2109, 0.3711, 0.2344, 1)))

        self.scroll.grid.next_back_input = TextInput(
            multiline=True,
            font_name="Rockwell",
            size_hint=(0.5, 0.05),
            cursor_color=(0.2109, 0.3711, 0.2344, 1))
        self.scroll.grid.add_widget(self.scroll.grid.next_back_input)
        self.scroll.grid.back_inputs.append(self.scroll.grid.next_back_input)

        self.num_added += 1

class CardCarousel(Carousel):
    def __init__(self, deck, **kwargs):
        super(CardCarousel, self).__init__(**kwargs)
        self.direction = "right"

        self.deck = get_current()
        for i, card in enumerate(deck.card_list):
            b = Flashcard(
                displayed=self.deck.card_list[i].info_front,
                hidden=self.deck.card_list[i].info_back,
                font_name="Future",
                size_hint=(0.5, 0.5),
                pos_hint={"x": 1.25, "top": 0.8},
                background_color=[150, 150, 150, 1],
                color=[0, 0, 0, 1]
            )
            self.add_widget(b)
        self.add_widget(Flashcard(
            displayed="",
            hidden="",
            font_name="Future",
            size_hint=(0.5, 0.5),
            pos_hint={"x": 1.25, "top": 0.8},
            background_color=[150, 150, 150, 1],
            color=[0, 0, 0, 1]
        ))

class Flashcard(Button):
    def __init__(self, displayed, hidden, **kwargs):
        super(Flashcard, self).__init__(**kwargs)
        self.text = displayed
        self.diplayed = displayed
        self.hidden = hidden
        self.on_press = self.flip

    def flip(self):
        temp = self.diplayed
        self.diplayed = self.hidden
        self.hidden = temp
        self.text = self.diplayed

class SetTile(Button):
    def __init__(self, **kwargs):
        super(SetTile, self).__init__(**kwargs)
        self.current_deck = get_current()
        for deck in load_decks():
            if deck.name == self.text:
                self.current_deck = deck
        self.on_press = self.press

    def press(self):
        set_current(self.current_deck)

class ListGrid(GridLayout):
    def __init__(self, **kwargs):
        super(ListGrid, self).__init__(**kwargs)
        self.size_hint_x = 0.75
        self.size_hint_y = None
        self.cols = 1
        self.size = (Window.width, Window.height)
        self.row_default_height = 50
        self.row_force_deafult = True

        self.add_widget(Label(
            text=""
        ))
        for i, deck in enumerate(load_decks()):
            b = SetTile(
                text=deck.name,
                font_name="Future",
                size_hint=(0.1, 0.1),
                pos_hint={"x": 1, "top": 0.8},
                background_color=[0.55, 0.9, 0.55, 1],
                color=[1, 1, 1, 1]
            )
            self.add_widget(b)

class DeckList(ScrollView):
    def __init__(self, **kwargs):
        super(DeckList, self).__init__(**kwargs)
        self.scroll_type = ['bars', 'content']
        self.scroll_wheel_distance = 40
        self.pos_hint = {"x": 0.1, "y": 0}
        self.do_scroll_x = False
        self.do_scroll_y = True
        self.size = (Window.width, Window.height)
        self.size_hint = (1, 1)

        self.grid = ListGrid()
        self.grid.bind(minimum_height=self.grid.setter('height'))
        self.add_widget(self.grid)

class LearnWindow(Screen):
    def __init__(self, **kwargs):
        super(LearnWindow, self).__init__(**kwargs)
        self.name = "learn"
        self.deck_view = DeckList()
        self.add_widget(self.deck_view)

class FlashcardWindow(Screen):
    def __init__(self, **kwargs):
        super(FlashcardWindow, self).__init__(**kwargs)
        self.name = "flashcards"
        self.add_widget(Image(source=os.path.join("assets", os.path.join("images", "title.png")),
            keep_ratio=True,
            size_hint=(0.25, 0.25),
            pos_hint={"x": 0.35, "top": 0.65}))
        self.carousel = CardCarousel(get_current())
        self.add_widget(self.carousel)

class WindowManager(ScreenManager):
    pass

kv = Builder.load_file("stego.kv")
class Stego(App):
    def build(self):
        self.icon = os.path.join("assets", os.path.join("images", "stego_icon.png"))
        return kv

if __name__ == "__main__":
    if not pyuac.isUserAdmin():
        Stego().stop()
        pyuac.runAsAdmin()
        
    else:
        Stego().run()