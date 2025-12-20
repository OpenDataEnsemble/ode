# Record

## Properties

| Name                 | Type                        | Description | Notes                             |
| -------------------- | --------------------------- | ----------- | --------------------------------- |
| **id**               | **string**                  |             | [default to undefined]            |
| **schemaType**       | **string**                  |             | [default to undefined]            |
| **schemaVersion**    | **string**                  |             | [default to undefined]            |
| **data**             | **{ [key: string]: any; }** |             | [default to undefined]            |
| **hash**             | **string**                  |             | [optional] [default to undefined] |
| **deleted**          | **boolean**                 |             | [optional] [default to undefined] |
| **change_id**        | **number**                  |             | [optional] [default to undefined] |
| **last_modified**    | **string**                  |             | [optional] [default to undefined] |
| **last_modified_by** | **string**                  |             | [optional] [default to undefined] |
| **origin_client_id** | **string**                  |             | [optional] [default to undefined] |

## Example

```typescript
import {Record} from './api';

const instance: Record = {
  id,
  schemaType,
  schemaVersion,
  data,
  hash,
  deleted,
  change_id,
  last_modified,
  last_modified_by,
  origin_client_id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
