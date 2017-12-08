## API
```js
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
```
