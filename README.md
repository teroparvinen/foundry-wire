# Whistler's Item Rolls Extended

This is a module for the Foundry virtual table top. It is specifically compatible with the dnd5e system.

As the name implies, the idea is to make item rolls easy and powerful, and to do that in a complete package, WIRE includes some extra functionality in addition to handling item rolls. The focus is not to automatically roll dice or make decisions, but rather to make sure as much of the activity around item rolls is presented conveniently.

https://i.imgur.com/cNdCbjN.mp4

In Foundry, item rolls refer to the activation of items in an actor's inventory, special abilities, class features and spells. Item rolls may apply damage and effects to other actors. The effects can have trigger conditions attached to them that trigger more of the same thing as combat progresses, including making saves to end the effect, applying damage to creatures entering an area or the effect target making an attack.

## Module status

**This is a pretty complicated module quite early in the development cycle. There will be bugs.** Do not use for your paid DM gig, but do try it out and report issues on GitHub or reach out to me on the Foundry discord server as _Whistler#3253_.

## Where to go for more information?

[The repository wiki](https://github.com/teroparvinen/foundry-wire/wiki) is where all documentation will be kept.

- Check out the feature list
- Recipes with examples of spells and skills and how to set them up
- Read up on how it works
- A list of conditions and updaters.
- A list of supported active effect changes/flags

## Compatible and incompatible modules

### libWrapper and socketlib

Dependencies required for operation. Nothing special here.

### Item Macro

The more advanced customization of the item rolls is controlled using a script macro on the item provided by this module. You can get by without it if you only use the UI components or an item library that has everything already built, but I strongly recommend installing this mod.

### Visual Active Effects / DFreds Effects Panel

Managing and viewing concentration and temporary active effects is quite important when using WIRE. These modules make it really easy to see the effects and to click them off when required. Highly recommended you use one of these with WIRE.

### Action Pack

Because WIRE aims to automate manual adjustments, there is less need to keep the character sheet constantly open. I originally made Action Pack as a companion for WIRE, but it turned into a stand-alone module. Check it out.

### DAE

Pretty much necessary at this point if only for the ability to edit active effects directly attached to an actor's spells. DAE is very heavily leaned towards co-operating with Midi-QOL, which is not compatible (see below), but for now using it is recommended.

### DFreds Convenient Effects

All status effects are handled using an integration with Convenient Effects. There is a fallback for concentration, but I highly recommend using CE.

### DF Template Enhancements

Recommended for 5e compatible template highlighting and automatic targeting. If you configure it to operate in toggle mode, WIRE will automatically toggle it to enable selection when templates are placed to select targets and otherwise keep it off.

### Automated Animations

WIRE will trigger AA animations at relevant points in the item roll.

### Dice So Nice

All rolls that are made will be rolled using 3D dice and will operate asynchronously, i.e. nothing will happen before the dice have landed.

### Midi-QOL

WIRE does many of the same things as Midi-QOL and some of them differently. It is not compatible and should not be used simultaneously. WIRE uses a similar flag naming scheme where possible to make adaptation easier both ways and will support Midi-QOL flags in effects.

### Times-up

WIRE has internal effect duration tracking that integrates with WIRE internals better than a separate module could. Times-up is no longer compatible with WIRE

### Active Auras

WIRE contains functionality for automatically attaching a template to the caster as well as auras for passive effects. Having Active Auras on should not be necessary and has not been tested.
