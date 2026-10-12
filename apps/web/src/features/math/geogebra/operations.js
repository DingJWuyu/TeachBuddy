const labelPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
// Mathematical construction only. No scripting, network, file or UI commands.
const mathCalls = new Set(('sin cos tan asin acos atan atan2 sinh cosh tanh exp ln log sqrt abs floor ceil round sgn min max mod nroot If Point Vector Line Segment Ray Circle Ellipse Hyperbola Parabola Polygon Polyline Midpoint Intersect PerpendicularLine ParallelLine Distance Length Angle Slope Area Perimeter Tangent Translate Rotate Reflect Dilate Integral Derivative Root Extremum Sequence Sum Product Curve Surface Plane Sphere Cone Cylinder Cube Prism Pyramid UnitVector Cross Dot Zip Element Function').split(' '));

function fail(message) { throw new Error(message); }
function name(value) {
  if (typeof value !== 'string' || !labelPattern.test(value)) fail('对象名称须以英文字母开头，仅包含字母、数字和下划线。');
  return value;
}
function number(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field}须为有限数值。`);
  return value;
}
function integer(value, low, high, field) {
  number(value, field);
  if (!Number.isInteger(value) || value < low || value > high) fail(`${field}须为 ${low} 至 ${high} 的整数。`);
}
function expression(value, knownNames) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000 || !/^[A-Za-z0-9_\s+\-*/^().,{}\[\]<>!=°π√]+$/.test(value) || /[\r\n]|(?<![<>=!])=(?!=)/.test(value)) fail('定义须为单个数学表达式或几何构造，不能包含赋值、脚本或多行命令。');
  for (const match of value.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*[([]/g)) {
    if (!mathCalls.has(match[1]) && !knownNames.has(match[1])) fail(`不支持构造命令 ${match[1]}。请使用数学表达式或已存在的函数。`);
  }
  return value;
}

export function validateOperations(operations, existingNames) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 100) fail('一次修改需要 1 至 100 个操作。');
  const known = new Set(existingNames);
  for (const op of operations) {
    if (!op || typeof op !== 'object') fail('修改操作格式不正确。');
    name(op.name);
    switch (op.type) {
      case 'define':
        if (op.arguments !== undefined && (!Array.isArray(op.arguments) || !op.arguments.length || op.arguments.length > 3 || op.arguments.some(argument => !['x', 'y', 'z', 't'].includes(argument)) || new Set(op.arguments).size !== op.arguments.length)) fail('函数自变量仅支持 x、y、z、t，不能重复。');
        expression(op.expression, known);
        known.add(op.name);
        break;
      case 'slider':
        for (const field of ['min', 'max', 'step', 'value']) number(op[field], field);
        if (op.min >= op.max || op.step <= 0 || op.value < op.min || op.value > op.max) fail('滑杆范围、步长或初值不正确。');
        known.add(op.name);
        break;
      case 'setValue': number(op.value, '取值'); break;
      case 'setCoords':
        if (!Array.isArray(op.coords) || ![2, 3].includes(op.coords.length)) fail('坐标需要两个或三个数值。');
        op.coords.forEach(value => number(value, '坐标'));
        break;
      case 'style':
        if (op.color !== undefined && !/^#[0-9a-f]{6}$/i.test(op.color)) fail('颜色需要 #RRGGBB 格式。');
        for (const field of ['visible', 'labelVisible']) if (op[field] !== undefined && typeof op[field] !== 'boolean') fail(`${field}须为布尔值。`);
        if (op.lineThickness !== undefined) integer(op.lineThickness, 1, 13, '线宽');
        if (op.lineStyle !== undefined) integer(op.lineStyle, 0, 4, '线型');
        if (op.pointSize !== undefined) integer(op.pointSize, 1, 9, '点大小');
        if (op.labelStyle !== undefined) integer(op.labelStyle, 0, 3, '标注样式');
        if (op.caption !== undefined && (typeof op.caption !== 'string' || op.caption.length > 1000)) fail('标注须为 1000 字以内的文本。');
        break;
      case 'rename':
        name(op.newName);
        if (known.has(op.newName)) fail(`对象 ${op.newName} 已存在。`);
        if (!known.has(op.name)) fail(`对象 ${op.name} 不存在。`);
        known.delete(op.name); known.add(op.newName);
        break;
      case 'delete':
        if (op.allowDependents !== undefined && typeof op.allowDependents !== 'boolean') fail('连带删除确认格式不正确。');
        break;
      default: fail(`不支持操作 ${op.type}。`);
    }
    if (!['define', 'slider', 'rename'].includes(op.type) && !known.has(op.name)) fail(`对象 ${op.name} 不存在。`);
    if (op.type === 'delete') known.delete(op.name);
  }
}

function ensure(api, objectName) {
  if (!api.exists(objectName)) fail(`对象 ${objectName} 不存在。`);
}

export async function executeOperation(api, op) {
  const target = op.name;
  if (!['define', 'slider'].includes(op.type)) ensure(api, target);
  switch (op.type) {
    case 'define': {
      const left = op.arguments ? `${target}(${op.arguments.join(',')})` : target;
      const labels = await api.asyncEvalCommandGetLabels(`${left}=${op.expression}`);
      if (!labels || !api.exists(target) || !api.isDefined(target)) fail(`GeoGebra 无法建立 ${target}，请检查表达式和引用对象。`);
      break;
    }
    case 'slider':
      if (api.exists(target) && api.getObjectType(target) !== 'numeric') fail(`${target} 已存在，且不是数值参数。`);
      if (!await api.asyncEvalCommandGetLabels(`${target}=Slider(${op.min},${op.max},${op.step},1,180,false,true,false,false)`)) fail(`无法建立滑杆 ${target}。`);
      api.setValue(target, op.value);
      if (Math.abs(api.getValue(target) - op.value) > 1e-9) fail(`滑杆 ${target} 的值未生效。`);
      break;
    case 'setValue': {
      if (!['numeric', 'boolean', 'angle'].includes(api.getObjectType(target)) || !api.isIndependent(target)) fail(`${target} 不是可独立修改的数值参数。`);
      const xml = new DOMParser().parseFromString(api.getXML(target), 'application/xml');
      const slider = xml.querySelector('slider');
      if (slider) {
        const low = Number(slider.getAttribute('min')); const high = Number(slider.getAttribute('max'));
        if (Number.isFinite(low) && Number.isFinite(high) && (op.value < low || op.value > high)) fail(`${target} 的值超出滑杆范围。`);
      }
      api.setValue(target, op.value);
      const expected = api.getObjectType(target) === 'boolean' ? (op.value === 1 ? 1 : 0) : op.value;
      if (Math.abs(api.getValue(target) - expected) > 1e-9) fail(`${target} 的值未生效。`);
      break;
    }
    case 'setCoords':
      if (!['point', 'vector'].includes(api.getObjectType(target)) || !api.isIndependent(target) || !api.isMoveable(target)) fail(`${target} 不是可自由移动的点或向量。`);
      api.setCoords(target, ...op.coords);
      if (op.coords.some((value, i) => Math.abs(api[['getXcoord', 'getYcoord', 'getZcoord'][i]](target) - value) > 1e-9)) fail(`${target} 的坐标未生效。`);
      break;
    case 'style':
      if (op.color !== undefined) {
        api.setColor(target, ...[1, 3, 5].map(offset => parseInt(op.color.slice(offset, offset + 2), 16)));
        if (api.getColor(target).toLowerCase() !== op.color.toLowerCase()) fail(`${target} 的颜色未生效。`);
      }
      for (const [key, setter, getter] of [['visible', 'setVisible', 'getVisible'], ['labelVisible', 'setLabelVisible', 'getLabelVisible'], ['labelStyle', 'setLabelStyle', 'getLabelStyle'], ['lineThickness', 'setLineThickness', 'getLineThickness'], ['lineStyle', 'setLineStyle', 'getLineStyle'], ['pointSize', 'setPointSize', 'getPointSize']]) {
        if (op[key] !== undefined) {
          api[setter](target, op[key]);
          if (api[getter](target) !== op[key]) fail(`${target} 的 ${key} 未生效。`);
        }
      }
      if (op.caption !== undefined) {
        api.setCaption(target, op.caption);
        if (String(api.getCaption(target, false)) !== op.caption) fail(`${target} 的标注未生效。`);
      }
      break;
    case 'rename':
      if (api.exists(op.newName) || !api.renameObject(target, op.newName) || !api.exists(op.newName) || api.exists(target)) fail(`无法把 ${target} 重命名为 ${op.newName}。`);
      break;
    case 'delete': {
      if (!op.allowDependents) {
        const token = new RegExp(`(^|[^A-Za-z0-9_])${target}([^A-Za-z0-9_]|$)`);
        const dependent = api.getAllObjectNames().find(other => other !== target && token.test(api.getCommandString(other, false)));
        if (dependent) fail(`${dependent} 依赖 ${target}，需要明确确认连带删除。`);
      }
      api.deleteObject(target);
      if (api.exists(target)) fail(`无法删除 ${target}。`);
      break;
    }
  }
}
