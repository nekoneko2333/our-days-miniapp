const controller = require('../../utils/editor-controller');
const methods = Object.assign({}, controller); delete methods.data;
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: { request: { type: Object, value: null, observer(value) { if (value) this.onLoad(value); } } },
  data: controller.data,
  methods
});
