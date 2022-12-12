# Changes by version number

### 0.10.3

Fixes

- The last update broke upcasting. Quick fix to that.

### 0.10.2

Changes

- Implemented damage reduction. The following flags are available:
    - `flags.wire.damagereduction.all` and `flags.wire.damagereduction.physical` will reduce all damage and all damage from nonmagical sources, respectively
    - `flags.wire.damagereduction.[damageType]` affects a particular damage type
    - `flags.wire.damagereduction.[attackType]` affects a particular attack type (mwak/rwak/msak/rsak)
    - Reduction is applied before all multipliers, including halving from a save or miss
- Added key bindings for confirming attack roll results as the GM
    - There are three options: Confirm hit, confirm miss, confirm as the calculated result comparing attack roll to AC
    - None are bound by default
- Death saves are now prompted when the turn of a PC at zero hit points begins.
- Made tokens in the chat cards clickable to select the token in question.
- Cleaned up the damage cards a bit. Less fancy icons, more readability.
- Added an "apply to all" option to NPC damage cards with multiple characters.
- If attacking with a melee weapon, no other melee weapon or shield is equipped and the weapon has versatile damage, a "Versatile" damage button is shown next to the default damage button which can be used to roll versatile damage.
- If attacking with two melee weapons equipped and entitled to use one in the off hand, an "Off hand" damage button is shown next to the default damage button
    - If the weapons are both light or if the character has the `flags.wire.dualWielder` flag, the character is determined to be entitled this option
    - The ability modifier bonus is removed from this attack (a `-@mod` bonus is applied) unless the character has the `flags.wire.twoWeaponFighting` flag.
- Settings! Settings may appear to get implemented pretty arbitrarily in the beginning. I will work on the easy to implement and the most requested first.
    - The hit point percentage threshold for the Convenient Effects "Wounded" condition to be applied to NPCs
    - Show round change notifications
    - Show turn change notifications
    - Reveal NPC turn change notifications to players (entries hidden in the combat tracker will still be hidden)
    - Reveal save DCs of abilities/spells used by NPCs, targeting PCs to the players
    - Hide the success/failure of an NPC saving against a PC ability/spell from the players

Fixes

- NPC concentration checks didn't work due to a version 10 regression issue
- Tidy5e sheets in dark mode do the nasty with the dnd5e system colors. Hardcoded some values to prevent item cards from losing their planned styles.
- Changing max hp occasionally caused the wounded/damaged conditions to be erroneously applied.
- Removed some DAE fields from the effect sheet, because they could be understood to be relevant for things WIRE does elsewhere. Let me know if these have a use in some context.
- Placing new tokens inside an aura effect now applies the aura correctly when the token is placed.
- Looking for the optimum user experience between the situation where a character has a token on the map and the situation where the game is focused on an overland map or other scene where player tokens are not present, WIRE processing now kicks in if the originating token is present, not selected. When the token is not present, rolls will be handled without WIRE. This gives the players a chance to cast spells that are usually used outside of combat.
- Hidden NPC tokens affected by area effect spells should no longer be visible in player facing save lists.
- The compendium importer matches items by type. No more Shield spell for the fighter with a Shield.

### 0.10.1

Changes

- Show advantage and disadvantage for rolled saves

Fixes

- Fixed a v10 update regression that prevented spell slots from being used when spells were cast. Oops.
- Changed the "A creature first enters the area on its turn" condition to be "A creature first enters the area on a turn", more in line with the rules
- Using WIRE without DAE no longer starts with an error
- The GM rolling with public rolls caused erroneous results. Public GM rolls should now work better.
