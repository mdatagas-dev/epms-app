# Yamazumi MVP Design

Each saved Line Balance renders a Yamazumi chart against one of its saved Capacity scenarios. The latest approved scenario is selected first; otherwise the latest scenario is used. The chart groups approved Standard Time elements by station, stacks manual and machine time, and draws the scenario's Takt Time on the same scale.

Station status is calculated from load divided by takt: overloaded above 100%, balanced from 85% through 100%, and underloaded below 85%. Guidance reports the exact overload only; it does not recommend moving a specific process because sequence, skill, and equipment constraints are not modeled. Without a Capacity scenario, the UI asks the Engineer to create one rather than inventing a takt value.
