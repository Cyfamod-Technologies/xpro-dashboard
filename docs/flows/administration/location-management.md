# Location Management

Super Admins configure Nigerian states, LGAs, and community hierarchies.

## Record fields

- Country, fixed to Nigeria initially
- State or Federal Capital Territory; Niger is the default
- Area name
- Area type, such as state, province, LGA, district, or community
- Parent area
- Official code where available
- Active status
- Optional map boundary reference

## Flow

1. Admin selects a state, LGA, or parent administrative area within Nigeria.
2. Admin creates or imports child areas.
3. System checks duplicate names/codes within the parent and prevents hierarchy cycles.
4. Admin reviews usage before deactivating an area.
5. Deactivation prevents new assignment but preserves existing records.

Location deletion is not allowed when records reference it. Renaming creates an audit event and must not change project identity.
