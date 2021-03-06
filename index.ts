const nn = require('@rdfjs/data-model').namedNode
const namespace = require('@rdfjs/namespace')

import { Quad, NamedNode, Source } from 'rdf-js'

export interface ResultNode {
  type :NamedNode,
  iri :string,
  distance :number
}

const ns = {
  vf: namespace('https://w3id.org/valueflows#'),
  rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
}

function subjects (quads :Quad[]) {
  return quads.map(quad => quad.subject as NamedNode)
}

function objects (quads :Quad[]) {
  return quads.map(quad => quad.object as NamedNode)
}

async function match (store :Source, subject ?:NamedNode, predicate ?:NamedNode, object ?:NamedNode, graph ?:NamedNode) {
  const results :Quad[] = []
    // @ts-ignore
    for await(const quad of store.match(subject, predicate, object, graph)) {
      results.push(quad)
    }
  return results
}

// TODO: use https://github.com/rdf-ext/clownface

async function outNodes (store :Source, subject :NamedNode, predicate :NamedNode) {
  return objects(await match(store, subject, predicate, null))
}

async function inNodes (store :Source, object :NamedNode, predicate :NamedNode) {
  return subjects(await match(store, null, predicate, object))
}

export function track (store :Source, iri :string) :AsyncIterableIterator<ResultNode>
export function track (store :Source, iri :NamedNode) :AsyncIterableIterator<ResultNode>
export async function * track (store :any, iri :any) :AsyncIterableIterator<ResultNode> {
  if (!iri.termType) iri = nn(iri)
  const visited :NamedNode[] = []
  yield * await tracker(store, visited, iri as NamedNode)
}

async function * tracker (store :Source, visited :NamedNode[], current :NamedNode, distance = 0)  :AsyncIterableIterator<ResultNode> {
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    yield {
      type: ns.vf('EconomicResource'),
      iri: current.value,
      distance
    }
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) yield * await tracker(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    yield {
      type: ns.vf('Process'),
      iri: current.value,
      distance
    }
    // find events
    const events = await inNodes(store, current, ns.vf('outputOf'))
    for (let event of events) yield * await tracker(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    yield {
      type: ns.vf('EconomicEvent'),
      iri: current.value,
      distance
    }
    // find processes taking it as input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    for (let process of inputToProcesses) yield * await tracker(store, visited, process, distance + 1)
    // find affected resources only if process takes it as an output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    if (outputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) yield * await tracker(store, visited, resource, distance + 1)
    }
  }
}

export function trace (store :Source, iri :string) :AsyncIterableIterator<ResultNode>
export function trace (store :Source, iri :NamedNode) :AsyncIterableIterator<ResultNode>
export async function * trace (store :any, iri :any) :AsyncIterableIterator<ResultNode> {
  if (!iri.termType) iri = nn(iri)
  const visited :NamedNode[] = []
  yield * await tracer(store, visited, iri as NamedNode)
}

async function * tracer (store :Source, visited :NamedNode[], current :NamedNode, distance = 0) :AsyncIterableIterator<ResultNode> {
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    yield {
      type: ns.vf('EconomicResource'),
      iri: current.value,
      distance
    }
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) yield * await tracer(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    yield {
      type: ns.vf('Process'),
      iri: current.value,
      distance
    }
    // find events
    const events = await inNodes(store, current, ns.vf('inputOf'))
    for (let event of events) yield * await tracer(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    yield {
      type: ns.vf('EconomicEvent'),
      iri: current.value,
      distance
    }
    // find processes taking it as output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    for (let process of outputToProcesses) yield * await tracer(store, visited, process, distance + 1)
    // find affected resources only if process takes it as an input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    if (inputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) yield * await tracer(store, visited, resource, distance +1)
    }
  }
}
