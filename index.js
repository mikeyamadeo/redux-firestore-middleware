import Promise from 'bluebird'

const methods = [ 'onSnapshot', 'get', 'set', 'update', 'add' ]

/**
 * @param types* {Array} - synchronous, success, and failure redux action types
 * @param payload {Object} - synchronous action payload
 * @param meta {Object} - metadata to pass through with both synchronous and asynchronous actions
 * @param bailout {Func} - function defined by user deciding, given redux state, whether to stop an api call
 * @param schema* {Object} - describes how returning data should be transformed
 *   @param name* {String} - what name to give the entity/ies
 *   @param key {String} - what entity property to use as the entities key value | defaults to 'id'
 *   @param transform {Func} - function given an entity as parameter
 * @param query* {Object} - describes the firestore query to build
 *   @param data {Object} - data to post to fb
 *   @param options {Object} - any options that need to be passed to fb (ex: {merge: true})
 *   @param collection* {String} - name of collection to access
 *   @param doc {String} - name of doc to access. collection prop is required
 *   @param subcollections {Array} - array of {collection, doc} values describing a path of nested records to access
 *   @param where {String || Array} - query string(s) describing queries to be made on the record(s). 'status == completed'
 *   @param method* {String} - firestore operation to execute (onSnapshot, get, update, set, add)
 */
export default ({ firestoreInstance, MIDDLEWARE_FLAG }) => {
  const buildQuery = makeQueryBuilder(firestoreInstance)
  return store => next => action => {
    const callStoreConfig = action[MIDDLEWARE_FLAG]
    if (typeof callStoreConfig === 'undefined') {
      return next(action)
    }

    _validateConfig(callStoreConfig)

    const {
      types,
      schema,
      payload,
      meta,
      query: queryConfig,
      bailout
    } = callStoreConfig
    if (bailout && bailout(store.getState())) {
      return Promise.resolve()
    }

    const actionWith = data => {
      let finalAction = { ...action, ...data }
      delete finalAction[MIDDLEWARE_FLAG]
      return finalAction
    }

    const [ requestType, successType, failureType ] = types
    next(actionWith({ type: requestType, payload, meta }))
    let query = buildQuery(queryConfig)
    const applySchema = makeSchemaApplier(schema)

    const onSuccess = response => {
      const schemaData = query.constructor.name === 'DocumentReference'
        ? response
        : response.docs
      return next(
        actionWith({
          type: successType,
          payload: applySchema(schemaData),
          meta
        })
      )
    }
    const onFail = FirebaseError => {
      console.warn(FirebaseError)
      next(actionWith({ type: failureType, meta: FirebaseError }))
      return Promise.reject(FirebaseError)
    }

    const { data } = queryConfig
    switch (queryConfig.method) {
      case 'onSnapshot':
        return query.onSnapshot(onSuccess, onFail)
      case 'get':
        return query.get().then(onSuccess).catch(onFail)
      case 'set':
        return query.set(data).then(onSuccess).catch(onFail)
      case 'add':
        return query.add(data).then(onSuccess).catch(onFail)
      case 'update':
        return query.update(data).then(onSuccess).catch(onFail)
    }
  }
}

const _buildRef = ({ ref, collection, doc }) => {
  ref = ref.collection(collection)

  if (doc) {
    ref = ref.doc(doc)
  }

  return ref
}

const typeCaste = value => Number(value) ? Number(value) : value

/**
 * @param storeRef {Object} - root firestore reference (firebase.firestore())
 * @param config {Object} - describes query to be built
 */
export const makeQueryBuilder = storeRef => config => {
  const { collection, doc, subcollections = [], where } = config

  let ref = [ { collection, doc }, ...subcollections ].reduce(
    (reduceRef, sub) => _buildRef({ ref: reduceRef, ...sub }),
    storeRef
  )

  if (where) {
    if (Array.isArray(where)) {
      where.forEach(query => {
        ref = ref.where(...query.split(' ').map(typeCaste))
      })
    } else {
      ref = ref.where(...where.split(' ').map(typeCaste))
    }
  }

  return ref
}

/**
  * INPUT ->
  * Schema: {
  *  key: '_id',
  *  name: 'users'
  * }
  * +
  * Data: {
  *  _id: 1
  *  firstName: 'tina'
  * }
  *
  * OUTPUT ->
  * Result: {
  *  entities: {
  *    '1': { _id: 1, firstName: 'tina'}
  *  }
  *  result: [1]
  * }
  *
  * 1. if no key is provided, assume response is either a single entity,
  * or an array of entities.
  * 2. if it is a single entity, wrap in array for ease of transformation
  */
const docToEntity = doc => ({ id: doc.id, ...doc.data() })
export const makeSchemaApplier = schema => response => {
  if (!schema) return response
  const entityTransform = schema.transform
    ? doc => schema.transform(docToEntity(doc))
    : doc => docToEntity(doc)

  let data = response

  /* [1] */
  if (data.constructor !== Array) {
    data = [ data ] /* [2] */
  }

  const entities = { [schema.name]: {} }

  let ids = []

  data.forEach((item, i) => {
    const entity = entityTransform(item)
    let _id = entity[schema.key || 'id']
    entities[schema.name][_id] = entity
    ids.push(_id)
  })

  return { entities, ids }
}

const _validateConfig = config => {
  if (!Array.isArray(config.types) || config.types.length !== 3) {
    throw new Error('Expected an array of three action types.')
  }
  if (!config.types.every(type => typeof type === 'string')) {
    throw new Error('Expected action types to be strings.')
  }
  if (typeof bailout !== 'undefined' && typeof bailout !== 'function') {
    throw new Error('Expected bailout to either be undefined or a function.')
  }
  if (!config.query) {
    throw new Error(
      `No 'query' value provided in firestore middleware config. 'query' required. query schema:
      @param query* {Object} - describes the firestore query to build
         @param data {Object} - data to post to fb
         @param options {Object} - any options that need to be passed to fb (ex: {merge: true})
         @param collection* {String} - name of collection to access
         @param doc {String} - name of doc to access. collection prop is required
         @param subcollections {Array} - array of {collection, doc} values describing a path of nested records to access
         @param where {String || Array} - query string(s) describing queries to be made on the record(s). 'status == completed'
         @param method* {String} - firestore operation to execute (onSnapshot, get, update, set, add)
      `
    )
  }

  if (!config.query.method) {
    throw new Error(
      `No 'method' value provided on 'query' property of firestore middleware config. 'method' required. Available methods: ${methods.map(
        m => '\n' + m
      )}`
    )
  }

  if (!config.query.collection) {
    throw new Error(
      `No 'collection' value provided in firestore middleware config`
    )
  }

  if (
    config.query.subcollections &&
      config.query.subcollections.constructor !== Array
  ) {
    throw new Error(
      `Unexpected Type: Subcollections property should be an array. From ${config.types[0]} call.`
    )
  }

  if (config.query.subcollections && !config.query.doc) {
    throw new Error(
      `No 'doc' value provided in firestore middleware config. Required in order to access subcollections`
    )
  }
}
