# FormModification

## Properties

| Name               | Type                                           | Description | Notes                             |
| ------------------ | ---------------------------------------------- | ----------- | --------------------------------- |
| **form**           | **string**                                     |             | [optional] [default to undefined] |
| **schema_changed** | **boolean**                                    |             | [optional] [default to undefined] |
| **ui_changed**     | **boolean**                                    |             | [optional] [default to undefined] |
| **core_changed**   | **boolean**                                    |             | [optional] [default to undefined] |
| **added_fields**   | [**Array&lt;FieldChange&gt;**](FieldChange.md) |             | [optional] [default to undefined] |
| **removed_fields** | [**Array&lt;FieldChange&gt;**](FieldChange.md) |             | [optional] [default to undefined] |

## Example

```typescript
import {FormModification} from './api';

const instance: FormModification = {
  form,
  schema_changed,
  ui_changed,
  core_changed,
  added_fields,
  removed_fields,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
