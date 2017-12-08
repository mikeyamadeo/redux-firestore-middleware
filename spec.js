import { makeQueryBuilder } from './index.js'

const where = refString => params => `${refString}.where(${params})`

const collection = refString => collectionName => {
  let _refString = `${refString}.collection('${collectionName}')`
  return {
    where: (...query) => where(_refString)(query),
    value: _refString,
    doc: docName => doc(_refString)(docName)
  }
}
const doc = refString => docName => {
  let _refString = `${refString}.doc('${docName}')`
  return {
    where: (...query) => where(_refString)(query),
    collection: collectionName => collection(_refString)(collectionName),
    value: _refString
  }
}
const storeRef = () => {
  return { collection: collectionName => collection('db')(collectionName) }
}

describe('query builder', () => {
  const db = storeRef()
  const queryBuilder = makeQueryBuilder(db)

  test('collection.where', () => {
    const expected = `db.collection('test').where(name,==,mikey)`
    expect(
      db.collection('test').where('name == mikey'.split(' '))
    ).toEqual(expected)
    expect(
      queryBuilder({ collection: 'test', where: 'name == mikey' })
    ).toEqual(expected)
  })

  test('collection.doc.where', () => {
    const expected = `db.collection('test').doc('hi').where(name,==,mikey)`
    expect(
      db.collection('test').doc('hi').where('name == mikey'.split(' '))
    ).toEqual(expected)
    expect(
      queryBuilder({ collection: 'test', doc: 'hi', where: 'name == mikey' })
    ).toEqual(expected)
  })

  test('collection.doc.collection.doc', () => {
    const expected = `db.collection('test').doc('hi').collection('yep').doc('yup').collection('yep').doc('yup')`
    expect(
      db
        .collection('test')
        .doc('hi')
        .collection('yep')
        .doc('yup')
        .collection('yep')
        .doc('yup').value
    ).toEqual(expected)
    expect(
      queryBuilder({
        collection: 'test',
        doc: 'hi',
        subcollections: [
          { collection: 'yep', doc: 'yup' },
          { collection: 'yep', doc: 'yup' }
        ]
      }).value
    ).toEqual(expected)
  })
})
