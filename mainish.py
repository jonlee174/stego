import pygame
import pygame.gfxdraw
import os
import math
import time

pygame.init()

width, height = 1000, 600
scale = 1
WIN = pygame.display.set_mode([width, height], pygame.RESIZABLE)
FPS = 60
WHITE, MOON_MIST, HUNTER_GREEN, LIGHT_OLIVE, MYRTLE, AGED_AVOCADO = (255, 255, 255), (220, 220, 200), (68, 105, 61), (184, 188, 134), (33, 66, 30), (160, 165, 121)
TREX_IMG = pygame.image.load(os.path.join("assets", os.path.join("images", "trex.png")))
STEGO_IMG = pygame.image.load(os.path.join("assets", os.path.join("images", "stego.png")) )
LEFT_ARROW_IMG = pygame.image.load(os.path.join("assets", os.path.join("images", "left_arrow.png")))
BUTTON_FONT = pygame.font.Font(os.path.join("assets", os.path.join("fonts", "future.ttf")), 35)
IN_CREATE_FONT = pygame.font.Font(os.path.join("assets", os.path.join("fonts", "future.ttf")), math.ceil(10*scale))
pygame.display.set_caption("Stego")
pygame.display.set_icon(STEGO_IMG)

create_text = BUTTON_FONT.render("CREATE", True, LIGHT_OLIVE)
view_text = BUTTON_FONT.render("LEARN", True, LIGHT_OLIVE)

main_view = True 
create_view = False

def draw_main_view():
    global create_text, view_text, main_view, create_view, scale

    width = pygame.display.get_window_size()[0]
    height = pygame.display.get_window_size()[1]
    scale = width / 1000

    MAIN_FONT = pygame.font.Font(os.path.join("assets", os.path.join("fonts", "african.ttf")), math.ceil(150*scale))
    menu_text = MAIN_FONT.render("STEGO", True, HUNTER_GREEN)
    
    create_text_rect = create_text.get_rect()
    create_text_rect.center = (width//2-120, height//2+30)
    view_text_rect = create_text.get_rect()
    view_text_rect.center = (width//2+130, height//2+30)

    WIN.fill(MOON_MIST)
    WIN.blit(pygame.transform.smoothscale(STEGO_IMG, (100*(scale*0.75), 100*(scale*0.75))), (width-125*scale, height-110*scale))
    WIN.blit(menu_text, (width//2-250*scale, height//12))

    pygame.gfxdraw.filled_polygon(WIN, ((width//2-200, height//2), (width//2-200, height//2+60), (width//2-40, height//2+60), (width//2-40, height//2)), HUNTER_GREEN)
    pygame.gfxdraw.aapolygon(WIN, ((width//2-200, height//2), (width//2-200, height//2+60), (width//2-40, height//2+60), (width//2-40, height//2)), LIGHT_OLIVE)
    if width//2-200 < pygame.mouse.get_pos()[0] < width//2-40 and height//2 < pygame.mouse.get_pos()[1] < height//2+60:
        create_text = BUTTON_FONT.render("CREATE", True, HUNTER_GREEN)
        pygame.gfxdraw.filled_polygon(WIN, ((width//2-200, height//2), (width//2-200, height//2+60), (width//2-40, height//2+60), (width//2-40, height//2)), LIGHT_OLIVE)
        pygame.gfxdraw.aapolygon(WIN, ((width//2-200, height//2), (width//2-200, height//2+60), (width//2-40, height//2+60), (width//2-40, height//2)), HUNTER_GREEN)
        if pygame.mouse.get_pressed()[0]:
            main_view = False
            create_view = True
    else:
        create_text = BUTTON_FONT.render("CREATE", True, LIGHT_OLIVE)

    pygame.gfxdraw.filled_polygon(WIN, ((width//2+200, height//2), (width//2+200, height//2+60), (width//2+40, height//2+60), (width//2+40, height//2)), HUNTER_GREEN)
    pygame.gfxdraw.aapolygon(WIN, ((width//2+200, height//2), (width//2+200, height//2+60), (width//2+40, height//2+60), (width//2+40, height//2)), LIGHT_OLIVE)
    if width//2+40 < pygame.mouse.get_pos()[0] < width//2+200 and height//2 < pygame.mouse.get_pos()[1] < height//2+60:
        view_text = BUTTON_FONT.render("LEARN", True, HUNTER_GREEN)
        pygame.gfxdraw.filled_polygon(WIN, ((width//2+200, height//2), (width//2+200, height//2+60), (width//2+40, height//2+60), (width//2+40, height//2)), LIGHT_OLIVE)
        pygame.gfxdraw.aapolygon(WIN, ((width//2+200, height//2), (width//2+200, height//2+60), (width//2+40, height//2+60), (width//2+40, height//2)), HUNTER_GREEN)
    else:
        view_text = BUTTON_FONT.render("LEARN", True, LIGHT_OLIVE)

    if (width//2-200 < pygame.mouse.get_pos()[0] < width//2-40 and height//2 < pygame.mouse.get_pos()[1] < height//2+60) or (width//2+40 < pygame.mouse.get_pos()[0] < width//2+200 and height//2 < pygame.mouse.get_pos()[1] < height//2+60):
        pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)
    else:
        pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_ARROW)

    WIN.blit(create_text, create_text_rect)
    WIN.blit(view_text, view_text_rect)

    pygame.display.update()

def draw_create_view():
    global create_view, main_view, scale, running

    width = pygame.display.get_window_size()[0]
    height = pygame.display.get_window_size()[1]
    scale = width / 1000

    IN_CREATE_FONT = pygame.font.Font(os.path.join("assets", os.path.join("fonts", "future.ttf")), math.ceil(10*scale))
    CREATE_TOP_FONT = pygame.font.Font(os.path.join("assets", os.path.join("fonts", "future.ttf")), math.ceil(15*scale))
    ct_text = IN_CREATE_FONT.render("TITLE", True, HUNTER_GREEN)
    cd_text = IN_CREATE_FONT.render("DESCRIPTION", True, HUNTER_GREEN)
    cc_text = CREATE_TOP_FONT.render("CREATE", True, LIGHT_OLIVE)

    ct_text_rect = ct_text.get_rect()
    ct_text_rect.center = (width//2-10*scale, height//14)
    cd_text_rect = cd_text.get_rect()
    cd_text_rect.center = (width//2-10*scale, height//11+30+20*scale)
    cc_text_rect = cc_text.get_rect()
    cc_text_rect.center = (((width-105*scale)+(65+25*scale)/2), 25*scale+(30+15*scale)/2)

    WIN.fill(MOON_MIST)
    WIN.blit(pygame.transform.smoothscale(LEFT_ARROW_IMG, (70, 50)), (10, 10))
    WIN.blit(ct_text, ct_text_rect)
    WIN.blit(cd_text, cd_text_rect)

    pygame.gfxdraw.filled_polygon(WIN, ((width//2-250*scale, height//14+10*scale), (width//2+250*scale, height//14+10*scale), (width//2+250*scale, height//14+35*scale), (width//2-250*scale, height//14+35*scale)), LIGHT_OLIVE)
    pygame.gfxdraw.aapolygon(WIN, ((width//2-250*scale, height//14+10*scale), (width//2+250*scale, height//14+10*scale), (width//2+250*scale, height//14+35*scale), (width//2-250*scale, height//14+35*scale)), HUNTER_GREEN)

    pygame.gfxdraw.filled_polygon(WIN, ((width//2-250*scale, (height//11+50)+20*scale), (width//2+250*scale, (height//11+50)+20*scale), (width//2+250*scale, (height//11+50)+65*scale), (width//2-250*scale, (height//11+50)+65*scale)), LIGHT_OLIVE)
    pygame.gfxdraw.aapolygon(WIN, ((width//2-250*scale, (height//11+50)+20*scale), (width//2+250*scale, (height//11+50)+20*scale), (width//2+250*scale, (height//11+50)+65*scale), (width//2-250*scale, (height//11+50)+65*scale)), HUNTER_GREEN)

    if width-105*scale < pygame.mouse.get_pos()[0] < width+65-80*scale and 25*scale < pygame.mouse.get_pos()[1] < 30+40*scale:
        pygame.draw.rect(WIN, MYRTLE, pygame.Rect(width-105*scale, 25*scale, 65+25*scale, 30+15*scale), 150, 5, 10, 10, 10, 10)
        cc_text = CREATE_TOP_FONT.render("CREATE", True, AGED_AVOCADO)
    else:
        pygame.draw.rect(WIN, HUNTER_GREEN, pygame.Rect(width-105*scale, 25*scale, 65+25*scale, 30+15*scale), 150, 5, 10, 10, 10, 10)
        cc_text = CREATE_TOP_FONT.render("CREATE", True, LIGHT_OLIVE)

    WIN.blit(cc_text, cc_text_rect)

    if 10 < pygame.mouse.get_pos()[0] < 80 and 10 < pygame.mouse.get_pos()[1] < 60 and pygame.mouse.get_pressed()[0]:
        create_view = False
        main_view = True

    if (10 < pygame.mouse.get_pos()[0] < 80 and 10 < pygame.mouse.get_pos()[1] < 60) or (width-105*scale < pygame.mouse.get_pos()[0] < width+65-80*scale and 25*scale < pygame.mouse.get_pos()[1] < 30+40*scale):
        pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)
    elif (width//2-250*scale < pygame.mouse.get_pos()[0] < width//2+250*scale and height//14+10*scale < pygame.mouse.get_pos()[1] < height//14+35*scale) or (width//2-250*scale < pygame.mouse.get_pos()[0] < width//2+250*scale and (height//11+50)+20*scale < pygame.mouse.get_pos()[1] < (height//11+50)+65*scale):
        pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_IBEAM)
    else:
        pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_ARROW)

    pygame.display.update()

clock = pygame.time.Clock()
running = True
while running:

    while main_view:
        draw_main_view()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                main_view = False

    while create_view:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                create_view = False

            '''if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_BACKSPACE:
                    if len(live_text.text) > 0:
                        live_text.text = live_text.text[:-1]
                else:
                    live_text.text += event.unicode
                live_text.img = live_text.font.render(live_text.text, True, live_text.color)
                live_text.rect.size = live_text.img.get_size()
                live_text.cursor.topleft = live_text.rect.topright'''

        draw_create_view()

        '''WIN.blit(live_text.img, live_text.rect)
        if time.time() % 1 > 0.5:
            pygame.draw.rect(WIN, live_text.color, live_text.cursor)'''

        pygame.display.update()

    clock.tick(FPS)