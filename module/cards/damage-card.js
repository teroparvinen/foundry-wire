import { wireSocket } from "../socket.js";
import { fromUuid, fudgeToActor, getActorToken, getSpeaker } from "../utils.js";

export class DamageCard {

    static templateName = "modules/wire/templates/damage-card.hbs";

    static activateListeners(html) {
        html.on("click", ".damage-card a", this._onDamageCardAction.bind(this));
        html.on("click", ".damage-card .expand-toggle", this._onExpandEntry.bind(this));
    }

    static async _onExpandEntry(event) {
        const img = event.currentTarget;
        const targetElem = img.closest(".damage-card-target");

        targetElem.classList.toggle('is-expanded');
    }

    static async _onDamageCardAction(event) {
        event.preventDefault();

        // Extract card data
        const button = event.currentTarget;
        button.disabled = true;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const damageCard = new DamageCard(message);
        const action = button.dataset.action;
        const targetUuid = button.closest('.damage-card-target')?.dataset.actorUuid;
        const target = targetUuid ? fudgeToActor(fromUuid(targetUuid)) : null;

        switch (action) {
            case "apply-damage":
                if (target && (game.user.isGM || target.isOwner)) {
                    await damageCard.applyDamage(target);
                }
                break;
            case "undo-damage":
                if (target && (game.user.isGM || target.isOwner)) {
                    await damageCard.undoDamage(target);
                }
                break;
            case "recalculate-damage":
                if (target && (game.user.isGM || target.isOwner)) {
                    await damageCard.recalculate(target);
                }
                break;
            case "option-halve-damage":
                if (target && (game.user.isGM || target.isOwner)) {
                    const current = damageCard.getOptions(target).isHalved;
                    if (current) {
                        await damageCard.setOptions(target, {
                            isHalved: false,
                            isDoubled: false
                        });
                    } else {
                        await damageCard.setOptions(target, {
                            isHalved: !current,
                            isDoubled: !!current
                        });
                    }
                }
                break;
            case "option-double-damage":
                if (target && (game.user.isGM || target.isOwner)) {
                    const current = damageCard.getOptions(target).isDoubled;
                    if (current) {
                        await damageCard.setOptions(target, {
                            isDoubled: false,
                            isHalved: false
                        });
                    } else {
                        await damageCard.setOptions(target, {
                            isDoubled: !current,
                            isHalved: !!current
                        });
                    }
                }
                break;
            case "apply-all":
                if (game.user.isGM) {
                    for (let entry of damageCard.targetEntries) {
                        if (!entry.isApplied) {
                            damageCard.applyDamage(entry.actor);
                        }
                    }
                }
                break;
            }

        button.disabled = false;
    }

    constructor(message) {
        const data = message.flags.wire;

        const actor = fromUuid(data.actorUuid);
        const targetEntries = data.targets.map(t => {
            return {
                actor: fudgeToActor(fromUuid(t.actorUuid)),
                token: fromUuid(t.tokenUuid),
                info: t.info,
                damage: t.damage,
                options: t.options,
                isApplied: t.isApplied,
                isConflicted: t.isConflicted
            }
        });

        this.message = message;
        this.isPlayer = targetEntries.every(t => t.actor.hasPlayerOwner);
        this.actor = actor;
        this.targetEntries = targetEntries;
    }

    async applyDamage(actor) {
        const entry = this.targetEntries.find(t => t.actor == actor);
        if (entry) {
            const attrs = actor.system.attributes;
            const isCurrent = attrs.hp.value == entry.info.hp && (attrs.hp.temp || 0) == entry.info.tempHp;

            if (isCurrent) {
                await actor.update({
                    'data.attributes.hp.value': entry.info.newHp,
                    'data.attributes.hp.temp': entry.info.newTempHp
                }, { 
                    dhp: (entry.info.hpDmg + entry.info.tempHpDmg > 0) ? -(entry.info.hpDmg + entry.info.tempHpDmg) : entry.info.hpHeal + entry.info.tempHpRaise
                });

                await this.updateActorEntry(actor, { isApplied: true });
            } else {
                await this.updateActorEntry(actor, { isConflicted: true });
            }

            await this.refreshCard();
        }
    }

    async undoDamage(actor) {
        const entry = this.targetEntries.find(t => t.actor == actor);
        if (entry) {
            const attrs = actor.system.attributes;
            const isCurrent = attrs.hp.value == entry.info.newHp && (attrs.hp.temp || 0) == entry.info.newTempHp;

            if (isCurrent) {
                await actor.update({
                    'data.attributes.hp.value': entry.info.hp,
                    'data.attributes.hp.temp': entry.info.tempHp
                }, {
                    dhp: (entry.info.hpDmg + entry.info.tempHpDmg > 0) ? (entry.info.hpDmg + entry.info.tempHpDmg) : -(entry.info.hpHeal + entry.info.tempHpRaise)
                });

                await this.updateActorEntry(actor, { isApplied: false });
            } else {
                await this.updateActorEntry(actor, { isConflicted: true });
            }

            await this.refreshCard();
        }
    }

    async recalculate(actor) {
        const entry = this.targetEntries.find(t => t.actor == actor);
        if (entry) {
            const info = DamageCard._getActorInfo(actor, entry.damage, entry.options);
            await this.updateActorEntry(actor, {
                info,
                isApplied: false,
                isConflicted: false
            });

            await this.refreshCard();
        }
    }

    getOptions(actor) {
        const entry = this.targetEntries.find(t => t.actor == actor) || {};
        return entry.options || {};
    }

    async setOptions(actor, changes) {
        const options = this.getOptions(actor);
        await this.updateActorEntry(actor, { options: foundry.utils.mergeObject(options, changes) });

        await this.recalculate(actor);
    }

    async updateActorEntry(actor, damage) {
        if (game.user.isGM) {
            const current = this.targetEntries.find(t => t.actor == actor) || {};
            const updated = foundry.utils.mergeObject(current, damage);
    
            this.targetEntries = this.targetEntries.map(td => {
                return td.actor == actor ? updated : td;
            });
    
            const data = await DamageCard._getFlagData(this.actor, this.targetEntries);
            await this.message.update({ "flags.wire": data });
        } else {
            await wireSocket.executeAsGM("updateDamageCardEntry", this.message.uuid, actor.uuid, damage);
        }
    }

    async refreshCard() {
        if (game.user.isGM) {
            const content = await DamageCard._renderContent(this.isPlayer, this.targetEntries);
            await this.message.update({ content });
        } else {
            await wireSocket.executeAsGM("refreshDamageCard", this.message.uuid);
        }
    }

    static async makeForActor(causingActor, targetActor, damageAmount) {
        const damage = {
            actor: targetActor,
            token: getActorToken(targetActor),
            points: { damage: damageAmount }
        };
        await DamageCard.make(causingActor, [damage]);
    }

    static async make(actor, targetDamage) {
        const pcDamage = targetDamage.filter(t => t.actor.hasPlayerOwner);
        const npcDamage = targetDamage.filter(t => !t.actor.hasPlayerOwner);

        if (pcDamage.length && npcDamage.length) {
            console.error("Cannot create damage card for both PCs and NPCs!");
            return;
        }

        const isPlayer = !!pcDamage.length;

        if (!isPlayer && !game.user.isGM) {
            const messageUuid = await wireSocket.executeAsGM("createDamageCard", actor?.uuid, targetDamage.map(td => {
                return {
                    actorUuid: td.actor.uuid,
                    tokenUuid: td.token.uuid || td.token.document.uuid,
                    points: td.points
                }
            }));
            const message = fromUuid(messageUuid);
            return new DamageCard(message);
        }

        const targetEntries = await DamageCard._buildTargetEntries(targetDamage);
        const flagData = await DamageCard._getFlagData(actor, targetEntries);
        const content = await DamageCard._renderContent(isPlayer, targetEntries);
        const speaker = getSpeaker(actor)

        const messageData = foundry.utils.mergeObject(
            {
                content,
                speaker,
                'flags.wire': flagData
            },
            isPlayer ? {} : {
                user: game.user.id,
                whisper: [game.user.id]
            }
        );
        const message = await ChatMessage.create(messageData);
        return new DamageCard(message);
    }

    static async _buildTargetEntries(targetDamage) {
        return targetDamage.map(t => {
            const actor = t.actor;
            const token = t.token.document;
            const info = DamageCard._getActorInfo(t.actor, t.points);
            const damage = t.points;
            return { actor, token, info, damage };
        });
    }

    static async _getFlagData(actor, targetEntries) {
        return {
            isDamageCard: true,
            actorUuid: actor?.uuid,
            targets: targetEntries.map(t => ({
                actorUuid: t.actor.uuid,
                tokenUuid: t.token.uuid || t.token.document.uuid,
                info: t.info,
                damage: t.damage,
                options: t.options,
                isApplied: t.isApplied,
                isConflicted: t.isConflicted
            }))
        };
    }

    static async _renderContent(isPlayer, targetEntries) {
        const templateData = {
            isGM: !isPlayer,
            targets: targetEntries
        };
        return await renderTemplate(DamageCard.templateName, templateData);
    }

    static _getActorInfo(actor, points, options = {}) {
        let dmg = points.damage || 0;
        let healing = points.healing || 0;
        let tempHpReceived = points.temphp || 0;
        const di = points.di || 0;
        const dr = points.dr || 0;
        const dv = points.dv || 0;
        const damagereduction = points.damagereduction;

        if (options.isHalved) {
            dmg = Math.floor(dmg * 0.5);
            healing = Math.floor(healing * 0.5);
            tempHpReceived = Math.floor(tempHpReceived * 0.5);
        }
        if (options.isDoubled) {
            dmg *= 2;
            healing *= 2;
            tempHpReceived *= 2;
        }

        const hp = actor.system.attributes.hp.value;
        const effectiveMaxHp = actor.system.attributes.hp.max + actor.system.attributes.hp.tempmax;
        const tempHp = actor.system.attributes.hp.temp || 0;
        const newTempHp = Math.max(0, tempHp - dmg, tempHpReceived);
        const newHp = Math.min(Math.max(0, Math.min(hp + tempHp - dmg, hp)) + healing, effectiveMaxHp);
        const hpDmg = Math.max(hp - newHp, 0);
        const tempHpDmg = Math.max(tempHp - newTempHp, 0);
        const totalDmg = hpDmg + tempHpDmg;
        const hpHeal = Math.max(newHp - hp, 0);
        const tempHpRaise = Math.max(newTempHp - tempHp, 0);

        return { hpDmg, tempHpDmg, totalDmg, hpHeal, tempHpRaise, hp, tempHp, newHp, newTempHp, di, dr, dv, damagereduction };
    }

}