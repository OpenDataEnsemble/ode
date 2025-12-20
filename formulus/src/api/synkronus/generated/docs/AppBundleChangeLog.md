# AppBundleChangeLog

## Properties

| Name                  | Type                                                     | Description | Notes                             |
| --------------------- | -------------------------------------------------------- | ----------- | --------------------------------- |
| **compare_version_a** | **string**                                               |             | [default to undefined]            |
| **compare_version_b** | **string**                                               |             | [default to undefined]            |
| **form_changes**      | **boolean**                                              |             | [default to undefined]            |
| **ui_changes**        | **boolean**                                              |             | [default to undefined]            |
| **new_forms**         | [**Array&lt;FormDiff&gt;**](FormDiff.md)                 |             | [optional] [default to undefined] |
| **removed_forms**     | [**Array&lt;FormDiff&gt;**](FormDiff.md)                 |             | [optional] [default to undefined] |
| **modified_forms**    | [**Array&lt;FormModification&gt;**](FormModification.md) |             | [optional] [default to undefined] |

## Example

```typescript
import {AppBundleChangeLog} from './api';

const instance: AppBundleChangeLog = {
  compare_version_a,
  compare_version_b,
  form_changes,
  ui_changes,
  new_forms,
  removed_forms,
  modified_forms,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
