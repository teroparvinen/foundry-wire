# Changes by version number

### 0.11.5

Fixes

- Addressed an incompatibility with a recent version of the module "Dynamic effects using Active Effects (DAE)"

### 0.11.4

Fixes

- Fixed an issue with roll formulas containing values from scale values like the monk's damage dice
- Partially fixed a further issue with the Automated Animations module. A complete fix requires a compatibility patch to the AA module as well, which I have submitted. The issue should be completely addressed after both modules receive the relevant update (this and the upcoming AA update).

### 0.11.3

Fixes

- Fixed a regression issue with some spell templates causing validation errors
- Updated to use the latest version of the Automated Animations API
- Changed the way aura effects track which tokens they affect, improving the way abilities can apply aura-style effects on multiple targets
- Some effects given through multiple different sources now track better in all cases and do not get inappropriately removed
- Item effects that have the "Treat the Effect Value as a roll and evaluate it when the effect is activated" option selected now more reliably roll the effect values when applied outside of WIRE rolls

### 0.11.2

Fixes

- Fixed a regression bug from the v11 update that was preventing some effects from displaying on tokens

### 0.11.1

Changes

- DF Template Enhancements has been the recommended way to target tokens using area effect templates. That mod hasn't been updated to support Foundry version 11 yet, so this version of WIRE contains a simple workaround that targets tokens using the Foundry stock templates when they are placed and that module is not active.

Fixes

- Damage immunity/resistance bypass now works correctly
- The target entry ("1 Creature" etc.) in the item property list on the desription tab will now properly show the value overridden by WIRE.
- When using the "Treat all out of turn actions as reactions" option, secondary activations (like spells affecting their targets on the target's turn) no longer cause the item owner to be flagged as having used their reaction.
- When showing the attack configuration dialog, WIRE will now collect all modifiers provided by other modules through hooks to display in the dialog. The bonuses did apply before the fix, but were not shown on the dialog.

### 0.11.0

Breaking changes

- Moved all WIRE scripts away from Item Macro and into data that is owned by WIRE. There is a migration process that will move the content of all item macros into WIRE scripts when a world is started using this version.
- With this change, Item Macro is no longer a recommended module to use with WIRE. In most cases it probably only adds confusion so at the moment it is recommended only if you must use it for something else that should trigger in parallel with what WIRE does. If an item has an Item Macro, WIRE will execute it when an item is rolled.

Changes

- Updated things to Foundry V11
- Guidance et al. were not working nicely with respect to when an effect was deleted as a result of a check or save having been completed. To address this, three new conditions were added, "Complete a skill check", "Complete an ability check" and "Complete an ability save". These will be triggered when the respective roll has been made and the `details` parameter will equal what was returned from the preparation condition. With this change several effects can also now affect a single roll with their own modifiers.
- There is a "WIRE Script" button at the top of each item sheet that can be used to access the WIRE script. This dialog has separate buttons for "Save" and "Save and close" allowing macro editing to continue while testing scripts as well as an "Activate item" button that activates the item rather than trying to execute the script as independent code.

Fixes

- Updated to the new version of the Convenient Effects API
- WIRE will now properly handle custom healing types outside the standard selection of `healing` and `temphp`.
- Fixed an issue passing non-string formulas to `game.wire.DamageParts.multiValue`.
- Fixed a dnd5e 2.1 compatibility issue with roll formula variables referring to actor traits.
- Fixed an issue that resolved some item activation clean up steps multiple times. This might cause bonus action and reaction conditions to be applied multiple times.
- Fixed a regression from the last update causing wrong buttons to highlight in d20 config dialogs.
- Fixed some issues happening when activating loot type items.

### 0.10.12

Module compatibility

- Arbron's Summoning: Implemented compatibility. Any possible configuration parameters registered on the WIRE activation will be available through `@config` on summoned creatures.
- The hook changes will probably help with generic module compatibility with roll configuration dialogs. Build-a-Bonus seems to work and Advantage Reminder messages should work as well.

Changes

- Implemented some dnd5e hooks that were missing after the transition to Foundry v10. As a result, other modules will probably work better. This change also included refactors to roll configuration dialogs to make the hooks more useful.
- Added a better attack roll breakdown for static bonuses.

### 0.10.11

Changes

- Reworked the configuration dialogs for attacks, saves, checks and damage a little. They now have more easily accessible mode buttons (advantage/disadvantage, normal/crit) and a bit friendlier titles.
- Concentration saves and death saves can now make modifications to the roll through the configuration dialog.
- Added API method `game.wire.DamageParts.multiValue` that takes an array of objects with `formula` and `type` keys. This can be passed to `activation.applyDamageRollParts` in flow step macros.
- Added a settings option to clear targets at the end of each turn.
- Damage rolls now have access to an `isCritical` variable, which is 1 if the attack was a crit and 0 otherwise.

Fixes

- Fixed a regression bug that crept in to aura effects in the last update
- Fixed an issue that would cause some damage vulnerability/resistance/immunity calculations not to be shown in the damage card (a visual issue).
- Fixed a permission issue with concentration and death saves
- Fixed an issue with actor token size updates with tiny characters

### 0.10.10

Changes

- Added flags for concentration and death save automatic failure and success: `flags.wire.fail.concentration`, `flags.wire.succeed.concentration`, `flags.wire.fail.deathSave`, `flags.wire.succeed.deathSave`.

Fixes

- Initial batch of fixes for dnd5e 2.1
- Evaluating damage formulas with the extended roll formula capabilities was giving some trouble. Implemented some improvements to how string values are treated in the formulas.
- Fixed an issue with concentration DCs
- Alt and Ctrl/Cmd work for advantage/disadvantage as concentration roll click modifiers

### 0.10.9

Changes
- Hovering over a token in the chat cards now highlights the token on the canvas.
- Condition triggered effects will have access to details about the triggering event in the effect value field formulas through the `@condition` variable. Generally, the interesting parts are available through `@condition.details`, which is the same details object that was passed to custom updaters.
    - Currently, probably the most useful application is that the "This attack hits", "Hits with [specifier] attack" and "Is hit by [specifier] attack" conditions pass information about the attack damage total through `@condition.details.damage.total`
    - An example of where this is useful is the Life Drain attack of the Specter
- Added a new roll formula function `substring`, that performs a non case sensitive comparison of the two strings passed as arguments and returns 1 if one of them contains the other as a substring and 0 otherwise.
- Reaction and Bonus Action tracking can now be enabled from the settings
    - If reaction tracking is enabled, using an item with a reaction activation cost will add a Convenient Effect called "Reaction" to the actor. Trying to use another reaction will prompt a warning at that point. The condition will be automatically removed at the start of each turn.
    - Bonus action tracking works similarly, using the "Bonus Action" condition. The condition is automatically removed at the end of each turn.
    - There is also an option to treat every action outside a character's turn as a reaction. This will add the condition on the first such use and prompt a warning consecutively. This can be useful for opportunity attacks and so on.
    - The conditions can also be manually added or removed and will be included in this processing.

Fixes

- Fixed a couple of issues with bonus healing handling. Now you can make a damage spell give some healing (which doesn't make sense), but also make healing spells give temp hp or a mix of heal bonus + temp hp.
- The activation configuration will get `spellLevel` and `upcastLevel` set even when spells are cast as innate or at-will. They will, in these cases, be set to the base level of the spell.
- Fixed a synchronization issue that could occur with saving throws
- Fixed an issue that would prevent some formula variables from working on effects created directly on characters

### 0.10.8

Changes

- Added a setting option to make the Wounded and Damaged condition icons show as overlays

Fixes

- When a missing condition/status is activated through an active effect, error notificatins won't be generated on the screen any more. It will just output a warning in the console.
- Fixed an issue preventing creating effects on non-linked token actors through the effect tab
- Fixed some bugs with tokens that have had their actor removed (PC tokens left over when the actual character was deleted)
- Auras now update when scenes are activated. This means that if the GM views another scene on their own, this update does not take place until the scene is activated for everyone.
- Auras only update on token movement in the active scene. This means that if the GM adjusts token locations on a scene they are viewing on their own, no aura triggering events will take place. Note that if you want to do some clandestine adjustment of tokens with passive template based area effects, you can toggle the effect off to prevent updates.
- Canceling variant selection now cancels the whole activation
- Fixed an issue with retrieving the damage from an activation using the API
- Using "While resolving outcome" effects on instant cast items could cause an error when removing the effect. This was fixed.

### 0.10.7

Changes

- An active effect's application phase can now be set to "While resolving outcome", which will apply the effect to all targets for the duration of the item roll resolution. This is helpful for effects that cause conditional save disadvantages or similar when the spell is initially cast, such as Shatter causing disadvantage to constructs. Usually best combined with the `@isFromItem` conditional variable in the Effect Value field.
- Extended the effect flag processing introduced for save advantage/disadvantage to damage minimization and maximization flags and save/check auto fail and auto succeed flags.
- Automatically failing or succeeding saves are now applied and displayed immediately when saves are prompted.
- When the actor size (in game terms: medium, large, huge etc.) is changed (possibly through an active effect), the token size is adjusted automatically. Further, the size change will check that the token does not end up in a prohibited location in relation to walls.
    - If the size change can't be completed because there is not enough space, the token will take the largest valid size that will fit.
    - When there are multiple viable locations for the resulting token placement, the ones closest to the starting position are preferred. If there are multiple within the same distance, one will be chosen at random (not always just top left).
    - The collision checks are done from individual grid square centers, so some niche conditions with zero width walls may need manual adjustment
- Added a new effect flag, `flags.wire.size.adjustment`. It is a number value that will adjust the size of a target by the specified number of steps. E.g. +1 will enlarge a medium creature to a size of large.
- Added an application flow step `applySelectedTargetsAlliesAsEffective` that applies selected targets and, if they are all allies, marks them effective, possibly skipping subsequent saving throw steps as unnecessary.

Fixes

- Miscellaneous fixes to small bugs

### 0.10.6

Changes

- Saves and ability checks rolled as a part of an item card activation now pass information about the triggering `@condition` as a variable to switch flags such as advantage/disadvantage flags (see the last update).
    - An example of where this is useful is the condition for Hideous Laughter to give advantage on a save when taking damage. This is now a wisdom save advantage flag with the value `eq(@condition.condition, "takes-damage")`.
    - This and the `@config` variable mentioned in the last update are now only present when rolling saves for the item causing the save, so if some hapless victim is subject to two spells that give a save when damage is taken, advantage will only be given to the save that matches the originating spell. If you just want to check if the save/check flag is from the item containing the effect, you can also use `@isFromItem` which may be clearer when you get back to editing it later.
    - These still need better documentation. My current plan is to implement a large part of the SRD spells and see where the APIs settle in that process, then start on improved documentation.

Fixes

- Fixed an issue with the formula string value handling introduced in the last update.
- Fixed some issues with aura effects from spells
- The "End the effect on a save" updater used the same logic as regular saving throws, which meant that if an item's initial effects were marked always effective (either always full damage or an effect that applies even on a failed attack or save), the save was skipped. This didn't make much sense since in all cases the save was explicitly required, so a new flow step option `performSavingThrowAlways` was added, and the "End the effect on a save" updater was converted to use this new logic.

### 0.10.5

Breaking changes

- Item duration specified in turns was previously counted as individual actors' turns. It is now considered to mean the specified number of the caster's turns, making it effectively the same as a duration in rounds but lasting until the end of that caster's turn. A duration of 1 turn therefore effectively means "until the end of this turn" and 2 turns means "until the end of your next round". Several spells use the latter and nothing in 5e uses how it currently works so hopefully not a very impactful breaking change.
- Some aspects of WIRE require more detailed duration tracking timing than what was possible using a separate module and Foundry hooks. Effect duration tracking was rolled into WIRE, and using Times Up is no longer recommended. A pop-up recommending disabling it will now be shown at start up. (See the change regarding the "The effect ends" condition below.)

Changes

- Added damage multipliers for damage types through `flags.wire.damage.multiplier.type.*` (including `healing` and `temphp`).
- Added multipliers for received damage through `flags.wire.grants.damage.multiplier.*` (otherwise similar to the delivering flags).
- Adding condition immunity to an actor now also removes all effects currently providing the condition
- Effects that get applied as a result of an item with an instantaneous duration are automatically removed after the activation completes. This sounds useless at first, but can be used to leverage the immunity condition removal above to heal conditions as part of heal spells and possibly to do some other stuff in the future.
- Two new settings for what happens when an NPC's turn begins
    - Disable the pan to the token
    - Disable token selection
- Logic functions are available for rolls. These can be used anywhere roll formulas are used, but the best application for them is in effect flags (see below). (I also released this as a stand alone module Logic Rolls.)
    - Test for equality or lack thereof using `eq`, `ne` (not equal) or `not`
    - Number comparisons `gt` (greater than), `gte` (greater than or equal), `lt`, `lte`
    - `and` and `or` for any number of arguments
    - If-then-else like functionality using `pick` and `unless` (if is a reserved word in javascript so it couldn't be used)
    - `includes` checks if the last parameter is equal to one of the other parameters
    - WIRE also contains an extension to roll parameter replacement that handles strings properly. Let me know if some exotic roll formula you need breaks.
- Damage formulas now have access to activation configuration data (settable through macros) via `@config`.
- Changed the way some effect flags that simply enable something are handled. Currently this is implemented for advantage/disadvantage flags, but will be added to additional flags in the future.
    - Earlier the WIRE SRD module convention was to flag every advantage/disadvantage using the ADD mode with a value of 1. This will still work.
    - For flags that have this treatment, the change mode is effectively ignored. If multiple instances of the same flag are present (from multiple effects), it is enough for one of them to evaluate to be effective.
    - What is new is that the value field is treated as a number. Any value that is greater than zero will mean the flag is enabled, anything zero or below will be disabled. The powerful bit is using this in conjunction with roll data (variables) that are passed along and the logic functions (see above).
    - The variables currently supported are
        - For attack roll advantage/disadvantage
            - `attacker` for the attacker's properties (e.g. `eq(@attacker.details.type.value, "undead")`)
            - `defender` for the defender's properties
            - `originator.isAttacker` is 1 if the originator (i.e. caster for spells) of the effect applying the flag is the attacker, 0 otherwise
            - `originator.isDefender` similar but the other way around
            - `config` is the activation configuration object for the hard core
        - For non-attack roll advantage/disadvantage
            - `actor` is the actor doing the roll
            - `config` is the activation configuration object if available (it is not available for basic rolls from the character sheet, for example)
    - An example of what this is good for is Chill Touch that makes undead targets do attacks at a disadvantage against the caster. In this case (will be available from the SRD in the future) set the flag `flags.wire.disadvantage.attack.all` to the value `and(@originator.isDefender, eq(@attacker.details.type.value, "undead"))`.
- Active effects now have two additional properties
    - Allow multiple applications: Normally, when an effect from one item affects a target that already has that effect, the old effect is removed. This setting prevents that. It allows stacking damage type effects such as Strength Drain.
    - Treat the Effect Value as a roll: If this is enabled, whatever is provided as the "value" of changes in this effect will be treated as dice rolls and rolled as the effect is applied. The result obtained as a result of a roll will persist, so don't use this for things like Bless that should roll a die as a part of another action. This is great for things like Strength Drain.
- PCs will be shown a variant of the concentration card when they hit 0 hp that will have a button to drop concentration. Accidentally dropping concentration can lead to a huge hassle with effects dropping, templates being deleted and duration tracking getting interrupted, so having a middle ground with a notification but no accidental drops is available here.
    - Added a setting for those who just dont care. It makes concentration drop immediately at 0 hp.
- New condition: "Target casts a spell". This will be triggered whenever an activation flow triggered from an item that is a spell reaches its end.
- New condition: "The effect ends". The condition will be triggered when an effect ends. This is typically triggered after all "turn ends" conditions have been fired and before any "turn starts" conditions have been triggered.
- Deprecated the activation flow step `attackCompleted`. The conditions triggered by it will now be automatically triggered whenever a flow containing the `performAttackRoll` step is completed.
- New application flow step option `applySelectedTargetsAsEffective`. This allows setting up items that always land, omitting attack rolls or saves.
- Added the possibility to add immunity conditions to items. Using an item on an immune target works exactly the same as items that grant immunity on a successful save, i.e. the creature can be targeted but the invocation is not effective.
    - There are four immunity categories: Creature type, Creature type not (exclusive version, see Hold Person), Condition immunity (creatures with a condition immunity are immune to this item) and Formula (which takes a formula)
    - The formula has the standard item properties available, as well as `@target` that can be used to refer to properties on the target.

Fixes

- Consumables were deleted a bit too early in the item roll process. Should now work better in all cases.
- Fixed some issues with damage multipliers
- Spell damage scaling now correctly multiplies numeric terms
- Fixed an issue with chat cards generated from conditions having buttons showing for players. This may have some side effects I missed in testing, let me know if your players are missing buttons.
- PCs now automatically go Unconscious at 0 hp
- Status effects from `wire.custom.statusEffect` and `wire.custom.persistentStatusEffect` should no longer be applied multiple times.
- The condition list on the active effect editing sheet was functioning similarly to the condition list on the item sheet, even when the sheets themselves did not (the item sheet saves as you make changes, the effect sheet has an explicit save button). This would cause changes to get lost when working with conditions on the effect sheet. This has now been fixed.
- Some miscellaneous bug fixes

### 0.10.4

Changes

- Item variants can now be created directly from the item sheet without having to write a macro script
    - In addition to being more casual user friendly, this will allow different activation flows for different variants
    - Added the `isVariant` activation flow step to branch based on variant activated.
    - The `selectVariant` method is still there, but it may go deprecated in the future
- New setting, "Damage roll confirms hit"
    - When selected, the GM rolling attacks for NPCs is also shown the damage buttons when the result of the attack is prompted. Clicking a damage button automatically calls the attack a hit and rolls damage, saving the GM a click. This will only happen if the application flow is the usual attack style flow, and won't have any effect for custom flows that do something else or attacks that don't have damage (like Ray of Enfeeblement).
- Sometimes you need to Lightning Bolt that corridor just in case. You can now confirm targeting with no targets selected. You'll be prompted to make sure it wasn't a mistake.
- Template handling changes
    - Circular templates with a range of Self (that will get attached to the casting token) now get their size calculated by taking into account the token size and extending out from the edge of the squares occupied by the token. For example, Spirit Guardians will extend 15' from the edge of the token, meaning that the template will be 7 squares at its widest point for a human cleric and 9 squares for a Cloud Giant cleric.
    - Removed the "Place measured template" selection option from the ability use dialog, because many abilities set up with WIRE that expect a template don't work properly without one.
    - Added the script method `skipTemplatePlacement` to provide an option to not place a template immediately
    - Added an activation flow step `placeTemplate` to allow the template to be placed later in the flow.
    - Added an activation flow step `removeSelfTarget` that untargets the caster if it is currently targeted. This is useful with template based items that originate from the caster or should not affect the caster.
- A focus on passive abilities
    - To make more powerful passive abilities possible, items show the Range and Target fields even when Activation is empty.
        - This only happens if the item has conditions or at least one effect with transfer enabled.
        - This is especially handy in a custom application flow with transfer effects. For example, this could automatically create a template (using the target size) centered on the character and apply damage and effects, making it possible to do things like monster auras that do damage to characters nearby.
    - Items that have active effects that are marked transferable ("Transfer effect to actor" or "Transfer to actor on item equip" with DAE) now support most relevant conditions when active.
    - A new condition is available for transfer effects: "The effect is created". This makes it possible to start all kinds of things automatically, like attaching a template to a monster when it is placed in the scene.
        - The transfer effects will be disabled if the token is dropped hidden (alt pressed) to not create templates and such. Enable the effect to trigger the creation condition.
    - The template handling changes mentioned above are quite powerful when combined with the rest of the passive ability changes. They make it possible to create templates from passives. For example:
        - Create a template at the start of the monster's turn, damaging everything around it
        - Create a template when the monster token is placed on the map, causing damage or effects on any token entering the template area
        - Some concrete examples:
            - The Ghast's Stench
            - The Ice Mephit's Death Burst
            - The Balor's Fire Aura
    - Samples of these will be available in the content modules in the near future.
- Items that have saves can be set to grant immunity on a successful save
    - This will activate an immunity effect on the character making the successful save
    - The immunity will be per item per actor, meaning that saving against one Harpy's Luring Song will not grant immunity against another's
    - The immunity effect does not have a duration set by WIRE, as most of the time the effect is so long it is better tracked outside of individual scene management.
- Made condition triggered cards a little less spammy. The card will only show up if and when there is something to interact with.
- Added two API functions to help other modules import compendium items:
    - `game.wire.getAvailablePackImports(actor)`
        - Takes an actor instance as a parameter
        - Returns an object with two keys, `upgradeableItems` and `replaceableItems`. Both contain an array of objects with the keys `actorItem` and `packItem`, representing pairs of items, one that is on the actor and the item in the packs that can be imported to replace it.
        - Upgradeable items are ones that have previously been imported and now have a new version available, while replaceable items are ones that never were but have a match with a similar name and item type in one of the packs.
        - Note that actor items may appear more than once in this list, if a match is found in multiple compendiums.
    - `game.wire.importPackItems(actor, entries)`
        - Takes an actor instance and an array of importable entries (see above) as parameters.
        - Use the entries from `getAvailablePackImports` to get relevant entries and filter and flatten to a single array as necessary
- Item macro API additions
    - Custom application flow steps can now call `activation.stop()` or `return false` to stop processing and skip all future steps.
    - `this.defaultFlow()` is useful for applying the regular processing after some initial custom steps. Added some similar prepackaged flows that skip a part of the whole tree and are guaranteed to do one thing while still avoiding the need to write down several steps that are usually executed together. I would love to hear any feedback about things like this.
        - `this.areaEffectFlow()` places a template if one has not yet been created, applies targets, does saves and damage rolls and finally applies effects and damage
        - `this.singleTargetFlow()` does an attack or save, rolls damage if necessary and applies effects and damage

Fixes

- The item details tab incorrectly offered a "Start of caster's turn" condition. It now offers the "Start of target's turn" condition instead.
    - The "Start of caster's turn" condition applies to things happening to characters other than the caster on the caster's turn
    - The "target" of conditions on the details page should be visualized as the target of the concentration effect (or similar), i.e. the original caster
- Concentration saves now properly apply advantage and disadvantage from concentration flags.
- NPC sheets now have access to the WIRE compendium importer tool
- For players, the compendium importer tool only lists items from compendia the GM has set visibile
- Corrected a bug in the aura radius calculation
- Auras affecting enemies no longer affect the aura bearer
- When a token with an active spell is removed, the effects of the spell are removed from the scene
- Fixed a v10 regression issue preventing the item Target value field from accepting a formula with variables
- Item Macro is an essential tool for setting up WIRE items, but a couple of the execution options it offers directly conflict with WIRE. A warning dialog now appears if starting with these settings enabled and offers to remedy the situation.
- The best intentions sometimes are no substitute for proper testing. Previously existing Midi-QOL flags on effects with a similar scheme in WIRE should now work better.

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
