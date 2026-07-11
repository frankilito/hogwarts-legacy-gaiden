#!/bin/bash
# 下载 KayKit CC0 资源(GitHub raw) + 字体
set -u
cd "$(dirname "$0")/.."
ADV="https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures"
SKE="https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons"
DUN="https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered"

dl() { # dl <url> <out>
  [ -s "$2" ] && return 0
  curl -sfL --retry 3 -o "$2" "$1" || echo "FAIL $1"
}
export -f dl

# 角色 (自带完整动画集)
for c in Mage Knight Rogue Rogue_Hooded Barbarian; do
  echo "$ADV/Characters/gltf/$c.glb assets/models/chars/$c.glb"
done > /tmp/dl_list.txt
for c in Skeleton_Mage Skeleton_Minion Skeleton_Rogue Skeleton_Warrior; do
  echo "$SKE/Characters/gltf/$c.glb assets/models/chars/$c.glb"
done >> /tmp/dl_list.txt

# 手持道具 (gltf+bin) + 纹理
for w in wand staff spellbook_open spellbook_closed sword_1handed shield_round mug_full quiver; do
  echo "$ADV/Assets/gltf/$w.gltf assets/models/props/$w.gltf"
  echo "$ADV/Assets/gltf/$w.bin assets/models/props/$w.bin"
done >> /tmp/dl_list.txt
for t in mage_texture knight_texture rogue_texture barbarian_texture; do
  echo "$ADV/Assets/gltf/$t.png assets/models/props/$t.png"
done >> /tmp/dl_list.txt
for w in Skeleton_Staff Skeleton_Blade Skeleton_Shield_Large_A; do
  echo "$SKE/Assets/gltf/$w.gltf assets/models/props/$w.gltf"
  echo "$SKE/Assets/gltf/$w.bin assets/models/props/$w.bin"
done >> /tmp/dl_list.txt
echo "$SKE/Assets/texture/skeleton_texture.png assets/models/props/skeleton_texture.png" >> /tmp/dl_list.txt

# 地牢建筑/道具
DPROPS="wall wall_arched wall_archedwindow_open wall_archedwindow_gated wall_window_open wall_window_closed wall_doorway_sides wall_doorway_Tsplit wall_corner wall_corner_small wall_endcap wall_half wall_half_endcap wall_pillar wall_shelves wall_broken wall_cracked wall_gated wall_Tsplit wall_crossing wall_sloped
floor_tile_small floor_tile_large floor_tile_small_decorated floor_tile_small_broken_A floor_tile_small_weeds_A floor_tile_big_grate floor_wood_large floor_wood_large_dark floor_dirt_large floor_dirt_small_weeds
stairs stairs_wide stairs_narrow stairs_wood stairs_walled
column pillar pillar_decorated barrier barrier_half barrier_corner barrier_column
table_long table_long_tablecloth table_long_tablecloth_decorated_A table_medium table_medium_tablecloth table_small table_small_decorated_A chair stool
bed_decorated bed_frame bed_floor shelf_large shelf_small shelves shelf_small_candles trunk_large_A trunk_medium_A trunk_small_A box_small box_large crates_stacked barrel_large barrel_small keg_decorated
banner_red banner_green banner_blue banner_yellow banner_patternA_red banner_patternA_green banner_patternA_blue banner_patternA_yellow banner_shield_red banner_shield_green banner_shield_blue banner_shield_yellow
candle candle_lit candle_thin_lit candle_triple candle_melted torch_lit torch_mounted
bottle_A_green bottle_A_brown bottle_A_labeled_green bottle_B_green bottle_B_brown bottle_C_green bottle_C_brown
plate plate_food_A plate_food_B plate_stack coin coin_stack_small coin_stack_medium coin_stack_large key keyring_hanging sword_shield sword_shield_gold rubble_half rubble_large"
for p in $DPROPS; do
  echo "$DUN/Assets/gltf/$p.gltf.glb assets/models/dungeon/$p.glb"
done >> /tmp/dl_list.txt
echo "$DUN/Assets/texture/dungeon_texture.png assets/models/dungeon/dungeon_texture.png" >> /tmp/dl_list.txt

# 字体
echo "https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf assets/fonts/Cinzel.ttf" >> /tmp/dl_list.txt
echo "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf assets/fonts/MaShanZheng.ttf" >> /tmp/dl_list.txt
echo "https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf assets/fonts/ZCOOLXiaoWei.ttf" >> /tmp/dl_list.txt

# 许可证
echo "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/main/LICENSE.txt assets/models/LICENSE-KayKit.txt" >> /tmp/dl_list.txt

wc -l < /tmp/dl_list.txt
cat /tmp/dl_list.txt | xargs -P 10 -n 2 bash -c 'dl "$0" "$1"'
echo "=== done ==="
find assets -type f | wc -l
du -sh assets