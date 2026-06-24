const CHARACTERS = (typeof require !== 'undefined')
  ? require('../data/characters.js').CHARACTERS
  : (typeof window !== 'undefined' && window.SRPG && window.SRPG.CHARACTERS);

function createCharacter(id) {
  const def = CHARACTERS[id];
  if (!def) throw new Error('Unknown character id: ' + id);
  return {
    id:       def.id,
    name:     def.name,
    position: def.position,
    level:    1,
    exp:      0,
    maxHp:    def.base.hp,
    hp:       def.base.hp,
    maxMp:    def.base.mp,
    mp:       def.base.mp,
    atk:      def.base.atk,
    def:      def.base.def,
    spd:      def.base.spd,
    skills:   [...def.skills],
    growth:   { ...def.growth },
    equip:    { weapon: null, armor: null },
    dead:     false,
  };
}

function createNewGame() {
  return {
    party:    [createCharacter('yuito')],
    inventory:{ drink: 2 },
    gold:     0,
    flags:    {},
    position: { map: 'field1', x: 5, y: 5 },
    settings: { autoAllies: true },
  };
}

function cloneState(s) {
  return structuredClone(s);
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { createCharacter, createNewGame, cloneState });
