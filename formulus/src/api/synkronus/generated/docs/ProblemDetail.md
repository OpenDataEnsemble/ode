# ProblemDetail

## Properties

| Name         | Type                                                                     | Description | Notes                             |
| ------------ | ------------------------------------------------------------------------ | ----------- | --------------------------------- |
| **type**     | **string**                                                               |             | [default to undefined]            |
| **title**    | **string**                                                               |             | [default to undefined]            |
| **status**   | **number**                                                               |             | [default to undefined]            |
| **detail**   | **string**                                                               |             | [default to undefined]            |
| **instance** | **string**                                                               |             | [optional] [default to undefined] |
| **errors**   | [**Array&lt;ProblemDetailErrorsInner&gt;**](ProblemDetailErrorsInner.md) |             | [optional] [default to undefined] |

## Example

```typescript
import {ProblemDetail} from './api';

const instance: ProblemDetail = {
  type,
  title,
  status,
  detail,
  instance,
  errors,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
