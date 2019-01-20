import { finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const nn = require('@rdfjs/data-model').namedNode
const namespace = require('@rdfjs/namespace')

import { Quad, NamedNode, Store, Term } from 'rdf-js'

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

async function match (store :Store, subject ?:NamedNode, predicate ?:NamedNode, object ?:NamedNode, graph ?:NamedNode) {
  const results :Quad[] = []
  await done(
    //@ts-ignore
    store.match(subject, predicate, object, graph)
      .on('data', (quad :Quad) => { results.push(quad) })
  )
  return results
}

// TODO: use https://github.com/rdf-ext/clownface

async function outNodes (store :Store, subject :NamedNode, predicate :NamedNode) {
  return objects(await match(store, subject, predicate, undefined))
}

async function inNodes (store :Store, object :NamedNode, predicate :NamedNode) {
  return subjects(await match(store, undefined, predicate, object))
}

export async function * track (store :Store, iri :(string | NamedNode)) {
  //@ts-ignore
  if (!iri.termType) iri = nn(iri)
  const visited :NamedNode[] = []
  yield * await tracker(store, visited, iri as NamedNode)
}

async function * tracker (store :Store, visited :NamedNode[], current :NamedNode, distance = 0)  :AsyncIterableIterator<ResultNode> {
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

export async function * trace (store :Store, iri :(string | NamedNode)) {
  // @ts-ignore
  if (!iri.termType) iri = nn(iri)
  const visited :NamedNode[] = []
  yield * await tracer(store, visited, iri as NamedNode)
}

async function * tracer (store :Store, visited :NamedNode[], current :NamedNode, distance = 0) :AsyncIterableIterator<ResultNode> {
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
