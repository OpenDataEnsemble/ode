---
sidebar_position: 7
---

# Troubleshooting

Common issues and solutions when using ODE.

## Connection Issues

### App Cannot Connect to Server

**Symptoms**: App shows connection error, cannot sync data

**Solutions**:
- Verify server is running and accessible
- Check server URL in app settings
- Verify network connectivity
- Check firewall settings
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For iOS simulator, use `localhost` or your machine's IP address

### Authentication Failures

**Symptoms**: Login fails, authentication errors

**Solutions**:
- Verify username and password are correct
- Check that user account exists on server
- Verify JWT secret is configured correctly on server
- Review server logs for authentication errors

## Synchronization Issues

### Observations Not Syncing

**Symptoms**: Observations remain in "pending" status

**Solutions**:
- Check network connectivity
- Verify server is accessible
- Review authentication credentials
- Check server logs for sync errors
- Ensure observations were saved locally before sync attempt
- Try manual sync from app settings

### Sync Conflicts

**Symptoms**: Data conflicts during synchronization

**Solutions**:
- ODE automatically resolves conflicts using version numbers
- Review conflict resolution in [Synchronization](/using/synchronization)
- Check that devices are using the same server
- Verify system clocks are synchronized

## Form Issues

### Forms Not Appearing

**Symptoms**: Forms don't appear in app

**Solutions**:
- Verify forms were uploaded to server
- Check that app has synchronized with server
- Review server logs for form upload errors
- Ensure form specifications are valid JSON
- Check form type and version match

### Form Validation Errors

**Symptoms**: Cannot submit form, validation errors

**Solutions**:
- Review form schema for required fields
- Check that data types match schema definitions
- Verify validation rules are correctly defined
- Review error messages for specific issues

## Formplayer Errors Explained

Common Formplayer errors, their causes, and fixes.

### ❌ "minimum value must be ['number']"

**Error Message:**
```
minimum value must be ['number']
```

**Cause:**
Using `$data` reference or non-numeric value in `minimum` or `maximum` property.

**Example (Unsafe):**
```json
{
  "type": "number",
  "minimum": { "$data": "#/properties/minValue" }  // ❌ $data not supported
}
```

**Fix:**
Use literal numeric values only:

```json
{
  "type": "number",
  "minimum": 0,  // ✅ Literal number
  "maximum": 100
}
```

**Prevention:**
- Always use literal numbers for `minimum` and `maximum`
- Never use `$data` references in validation constraints
- Validate schema before deployment

### ❌ "Cannot read properties of undefined (reading 'find')"

**Error Message:**
```
Cannot read properties of undefined (reading 'find')
TypeError: Cannot read properties of undefined (reading 'find')
```

**Cause:**
One of several issues:
1. Layout missing `elements` array
2. Invalid `scope` path (field doesn't exist in schema)
3. Rule referencing missing field

**Example 1 - Missing elements:**
```json
{
  "type": "SwipeLayout"
  // ❌ Missing elements array
}
```

**Fix:**
```json
{
  "type": "SwipeLayout",
  "elements": []  // ✅ Always include elements array
}
```

**Example 2 - Invalid scope:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/missingField"  // ❌ Field doesn't exist
  }
}
```

**Fix:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" },
      "missingField": { "type": "string" }  // ✅ Add field to schema
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/missingField"
  }
}
```

**Example 3 - Rule referencing missing field:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/field1",
    "rule": {
      "condition": {
        "scope": "#/properties/missingField",  // ❌ Field doesn't exist
        "schema": { "const": "value" }
      }
    }
  }
}
```

**Fix:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" },
      "missingField": { "type": "string" }  // ✅ Add referenced field
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/field1",
    "rule": {
      "condition": {
        "scope": "#/properties/missingField",
        "schema": { "const": "value" }
      }
    }
  }
}
```

**Prevention:**
- Always include `elements: []` in layouts (can be empty)
- Validate all `scope` paths exist in schema
- Ensure all fields referenced in rules exist in schema
- Use form validation script before deployment

### ❌ "Rule condition scope not found"

**Error Message:**
```
Rule condition scope "#/properties/field" not found in schema
```

**Cause:**
Rule condition references a field that doesn't exist in the JSON schema.

**Example:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
      // field2 doesn't exist
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/field1",
    "rule": {
      "effect": "SHOW",
      "condition": {
        "scope": "#/properties/field2",  // ❌ Field doesn't exist
        "schema": { "const": "value" }
      }
    }
  }
}
```

**Fix:**
Add the referenced field to the schema:

```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" },
      "field2": { "type": "string" }  // ✅ Add referenced field
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/field1",
    "rule": {
      "effect": "SHOW",
      "condition": {
        "scope": "#/properties/field2",
        "schema": { "const": "value" }
      }
    }
  }
}
```

**Prevention:**
- Always define all fields referenced in rules in the schema
- Use form validation script to catch these errors
- Test all conditional logic paths

### ❌ "SwipeLayout missing required elements array"

**Error Message:**
```
SwipeLayout missing required "elements" array
```

**Cause:**
SwipeLayout (or other layout) is missing the `elements` property.

**Example:**
```json
{
  "type": "SwipeLayout"
  // ❌ Missing elements
}
```

**Fix:**
```json
{
  "type": "SwipeLayout",
  "elements": []  // ✅ Always include elements array
}
```

**Prevention:**
- Always include `elements` array in layouts
- Use form validation script
- Test forms before deployment

### ❌ "Invalid scope path"

**Error Message:**
```
Invalid scope path: "#/properties/nonexistent"
Scope does not exist in schema
```

**Cause:**
Control `scope` references a property that doesn't exist in the JSON schema.

**Example:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/nonexistent"  // ❌ Field doesn't exist
  }
}
```

**Fix:**
Either add the field to schema or correct the scope:

```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" },
      "nonexistent": { "type": "string" }  // ✅ Add field
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/nonexistent"
  }
}
```

**Prevention:**
- Validate all scope paths before deployment
- Use form validation script
- Keep schema and UI schema in sync

### ❌ "$data is not supported"

**Error Message:**
```
$data is not supported in Formplayer
```

**Cause:**
Using `$data` references in schema (e.g., in `minimum`, `maximum`, or validation rules).

**Example:**
```json
{
  "type": "number",
  "minimum": { "$data": "#/properties/minValue" }  // ❌ Not supported
}
```

**Fix:**
Use literal values only:

```json
{
  "type": "number",
  "minimum": 0  // ✅ Literal value
}
```

**Prevention:**
- Never use `$data` references
- Use literal values for all constraints
- Refer to [Supported Schema Profile](/reference/formplayer#supported-schema--ui-profile)

### ❌ "Form failed to render"

**Symptoms:**
Form doesn't display, blank screen, or error in console.

**Common Causes:**
1. Invalid JSON syntax
2. Missing required schema properties
3. Unsupported schema features
4. Invalid UI schema structure

**Solutions:**
1. Validate JSON syntax
2. Check schema follows supported profile
3. Verify UI schema structure (SwipeLayout root, elements arrays)
4. Review browser console for specific errors
5. Test with form validation script

### General Error Prevention

1. **Use Validation Script**: Run `npm run validate:forms` before deployment
2. **Check Supported Features**: Refer to [Supported Schema Profile](/reference/formplayer#supported-schema--ui-profile)
3. **Test on Devices**: Test forms on actual mobile devices
4. **Review Error Messages**: Error messages often indicate the specific issue
5. **Validate Scope Paths**: Ensure all scope paths exist in schema
6. **Avoid Unsupported Features**: Don't use `$data`, `if/then/else`, etc.

### Getting Help with Errors

If you encounter errors not covered here:

1. Check [Form Design Guide](/guides/form-design) for best practices
2. Review [Formplayer Reference](/reference/formplayer) for supported features
3. Validate your form using the validation script
4. Check browser/device console for detailed error messages
5. Report issues following [guidelines](/community/getting-help)

## Data Issues

### Observations Not Saving

**Symptoms**: Observations disappear after creation

**Solutions**:
- Check device storage space
- Verify database is accessible
- Review app logs for database errors
- Ensure app has necessary permissions

### Data Loss

**Symptoms**: Observations are missing

**Solutions**:
- Check sync status to see if data is on server
- Review server logs for deletion records
- Verify backups are configured
- Check that observations weren't accidentally deleted

## Performance Issues

### Slow App Performance

**Symptoms**: App is slow, forms take time to load

**Solutions**:
- Check device storage space
- Review number of observations stored locally
- Clear app cache if needed
- Ensure app is updated to latest version
- Check device memory usage

### Slow Synchronization

**Symptoms**: Sync takes a long time

**Solutions**:
- Check network speed and stability
- Review number of observations to sync
- Check server performance and load
- Verify attachment sizes are reasonable
- Consider syncing during off-peak hours
- On slow radio, Formulus starts with small pages (32 pulled / 4 pushed) and can drop to one observation at a time. Observation data can finish while photos are still downloading.
- Confirm the reverse proxy allows ~10 minute transfers (see [Server Architecture for IT](/docs/guides/server-architecture-for-it))

## Getting Additional Help

If you cannot resolve an issue:

1. Review relevant documentation sections
2. Check [GitHub Issues](https://github.com/OpenDataEnsemble/ode/issues) for similar problems
3. Search the [Community section](/community/getting-help) for solutions
4. Review [API Reference](/reference/api/overview) for technical details
5. Report issues following the [guidelines](/community/reporting-issues)

## Next Steps

- Review [Synchronization](/using/synchronization) for sync-related issues
- Check [Installation guides](/docs/getting-started/installation) for setup problems
- Explore [API Reference](/reference/api/overview) for integration issues

