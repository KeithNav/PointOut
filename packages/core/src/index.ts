import { PointOut } from './PointOut';

export type { Annotation, PointOutConfig, PointOutUser, Role, ToolType } from './types';
// Default-only export keeps the IIFE build a plain `window.PointOut = <class>` for <script> tag usage.
export default PointOut;
