const test=require('node:test'); const assert=require('node:assert');
const { serialize, deserialize } = require('../src/logic/save.js');

test('serialize→deserialize で同値に戻る', () => {
  const s={party:[{id:'yuito',level:3}],gold:120,flags:{ikuma:true},position:{map:'field1',x:5,y:5},settings:{autoAllies:true},inventory:{drink:2}};
  assert.deepStrictEqual(deserialize(serialize(s)), s);
});
test('壊れた文字列は null', () => {
  assert.strictEqual(deserialize('{oops'), null);
});
test('空文字や null も null', () => {
  assert.strictEqual(deserialize(''), null);
  assert.strictEqual(deserialize('null'), null);
});
test('data フィールドが無いJSONは null', () => {
  assert.strictEqual(deserialize('{"version":1}'), null);
});
test('serialize の出力は version を含む', () => {
  const s={gold:0};
  const obj=JSON.parse(serialize(s));
  assert.strictEqual(obj.version,1);
  assert.deepStrictEqual(obj.data,s);
});
