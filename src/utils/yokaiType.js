// 妖怪の「種類(type)」に応じたバッジ用CSSクラス名を返す。
// 伝承(古くからの言い伝え) / 民俗芸能(お祭りや踊りに登場する存在) /
// ご当地(特産品などをモチーフにしたオリジナルキャラ) / オリジナル(身近なものおばけ)
export function typeClassName(type) {
  switch (type) {
    case '伝承':
      return 'densho'
    case '民俗芸能':
      return 'geino'
    case 'ご当地':
      return 'gotouchi'
    default:
      return 'original'
  }
}
