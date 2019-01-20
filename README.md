# @valueflows/track-trace

Implementation of [track & trace algoritms](https://www.valueflo.ws/appendix/track.html) in TypeScript.

* it provides async iterators interface which one can use together with [`for - await - of`](https://github.com/tc39/proposal-async-iteration#the-async-iteration-statement-for-await-of)
* it requires data providing [RDFJS Source interface](http://rdf.js.org/#source-interface)

## Usage

```bash
yarn add @valueflows/track-trace
```

```js
import { track, trace } from '@valueflows/track-trace'
import data from './store'

const entityInData = 'https://some.example/fbb63f10-ae72-4471-b1d2-a1931208932e'

;(async () => {
  for await (const node of track(data, entityInData)) console.log(node)
  for await (const node of trace(data, entityInData)) console.log(node)
})

```

### ResultNode

Iterator iterates over results nodes described by this interface:

```ts
interface ResultNode {
  type :NamedNode,
  iri :string,
  distance :number
}
```