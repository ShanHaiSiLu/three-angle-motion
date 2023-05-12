import {
  Vector2,
  Vector3,
  CurvePath,
  BufferGeometry,
  MeshStandardMaterial,
  Group,
  LineCurve,
  LineCurve3,
  SphereGeometry,
  Mesh,
  TubeGeometry,
  Shape,
  ShapeGeometry,
  DoubleSide,
} from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

export class LengthLabel {
  constructor(position = new Vector3(0, 0, 0), text = "") {
    this.dom = document.createElement("div");
    this.dom.className = "length-label";
    this.dom.innerHTML = text;

    this.text = text;

    this.label = new CSS2DObject(this.dom);
    this.label.position.copy(position);

    this.visible = true;
  }

  // 复制位置，参数是vector3
  copyPosition(p) {
    this.label.position.copy(p);
  }

  // 设置位置的xyz值，参数是三个float
  setPosition(x, y, z) {
    this.label.position.set(x, y, z);
  }

  // 设置文本标签内容
  setText(text) {
    this.dom.textContent = text;
    this.text = text;
  }

  // 显示
  show() {
    this.dom.style.display = "none";
    this.label.visible = true;

    this.visible = true;
  }

  // 隐藏
  hide() {
    this.dom.style.display = "";
    this.label.visible = false;

    this.visible = false;
  }

  // 切换可见性
  toggleVisible() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // 销毁这个文本标签
  destroy() {
    this.dom.parentNode.removeChild(this.dom);
    this.label.removeFromParent();
  }
}

export class DistenceLine {
  // 标准球geometry
  standerSphereGeometry = new SphereGeometry(0.1);
  // 测距线上的球mesh的原型
  dottingdSphere = new Mesh(
    this.standerSphereGeometry,
    new MeshStandardMaterial({ color: 0xff0000 }),
  );

  /** @测距线相关变量 */
  dottingPositions = []; // 打点的位置
  distencePath = new CurvePath(); // 组成测距线的path
  distenceGeometry = new BufferGeometry(); // 测距线path生成的管道模型的geometry
  distenceTubeMaterial = new MeshStandardMaterial({ color: 0x01fa00 });
  distenceTubeMesh; /**@不会被清理的变量 测距线管道模型 */
  dottingLabels = []; /**@不会被清理的变量 测距线上的文字标签 */
  dottingLineSphereMesh = new Group(); /**@不会被清理的变量 测距线上的球mesh */

  /** @闭合管道的相关变量 */
  closedPath = new LineCurve3();
  closedMaterial = new MeshStandardMaterial({ color: 0xfa52c4 });
  closedGeometry;
  clonedMesh; /**@不会被清理的变量 */

  /** @预选区相关变量 */
  readySphere = new Mesh(this.standerSphereGeometry, new MeshStandardMaterial()); // 预选区的球mesh
  readyPath = new LineCurve3();
  readyTubeMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.4,
  });
  readyGeometry = new BufferGeometry();
  readyTubeMesh;
  readyLabel = new LengthLabel();

  constructor(plottingScale = 1, unit = "米") {
    // 比例尺
    this.plottingScale = plottingScale;
    // 单位
    this.unit = unit;

    // 将需要显示的mesh整合
    this.meshs = new Group();

    this.meshs.add(this.readySphere);
    this.meshs.add(this.dottingLineSphereMesh);
    this.meshs.add(this.readyLabel.label);
  }

  // 测距线上增加一个点
  addPoint(position) {
    // 添加球体
    let _sphere = this.dottingdSphere.clone(true);

    _sphere.position.copy(position);

    // 球体添加到球体组中
    this.dottingLineSphereMesh.add(_sphere);

    // 记录点位置
    this.dottingPositions.push(position.clone());

    // 根据是否已有点判断是否需要生成tube
    if (this.dottingPositions.length === 1) {
      // 只有一个点
      this.readyPath.v1.copy(position);
    } else {
      // 有多个点
      this.#updateTubeMesh(position);
    }
  }

  // 更新测距线管道mesh
  #updateTubeMesh(position) {
    this.readyPath.v2.copy(position);

    let _path = this.readyPath.clone();

    // 清理原本的形状和mesh
    if (this.distenceGeometry) this.distenceGeometry.dispose();
    if (this.distenceTubeMesh) this.distenceTubeMesh.removeFromParent();

    // 记录要添加的path
    this.distencePath.add(_path);

    // 生成对应管道
    this.distenceGeometry = new TubeGeometry(
      this.distencePath,
      this.dottingPositions.length * 50,
      0.06,
    );
    this.distenceTubeMesh = new Mesh(this.distenceGeometry, this.distenceTubeMaterial);
    this.meshs.add(this.distenceTubeMesh);

    // 增加标签
    let texLabel = new LengthLabel(
      _path.v1.clone().lerp(_path.v2, 0.5),
      (_path.v1.distanceTo(_path.v2) * this.plottingScale).toFixed(2) + this.unit,
    );
    this.meshs.add(texLabel.label);
    this.dottingLabels.push(texLabel);

    // 更新预备路径起点
    this.readyPath.v1.copy(this.readyPath.v2);
  }

  // 更新预选区position
  updateReadyPosition(position) {
    console.log("更新预选区");
    this.readySphere.position.copy(position);

    // 仅当已经打上至少一个点的时候执行以下步骤
    if (this.dottingPositions.length === 0) return;

    // 更新虚拟管道对应的路径
    this.readyPath.v2.copy(this.readySphere.position);

    // 更新预备标签
    this.readyLabel.copyPosition(this.readyPath.v1.clone().lerp(this.readyPath.v2, 0.5));
    this.readyLabel.setText(
      (this.readyPath.v1.distanceTo(this.readyPath.v2) * this.plottingScale).toFixed(2) + this.unit,
    );

    // 清空之前的形状和物体
    if (this.readyGeometry) this.readyGeometry.dispose();
    if (this.readyTubeMesh) this.readyTubeMesh.removeFromParent();

    // 更新预备区管道
    this.readyGeometry = new TubeGeometry(this.readyPath, 20, 0.05);
    this.readyTubeMesh = new Mesh(this.readyGeometry, this.readyTubeMaterial);
    this.meshs.add(this.readyTubeMesh);
  }

  // 结束打点
  endDotting() {
    // 如果有大于两个点，也就是有转折，那么连接首尾并进行统计
    // 也就是将管道进行闭合操作
    if (this.dottingPositions.length > 2) {
      this.closeDottingLineTube();
    }

    this.clearDiscardVariable();
  }

  // 闭合管道
  closeDottingLineTube() {
    // 确定闭合管道的path，一个从起点直接指向终点的path
    this.closedPath.v1.copy(this.dottingPositions[0]);
    this.closedPath.v2.copy(this.dottingPositions[this.dottingPositions.length - 1]);

    // 更新闭合管道的geometry和mesh
    this.closedGeometry = new TubeGeometry(this.closedPath, 20, 0.06);
    this.clonedMesh = new Mesh(this.closedGeometry, this.closedMaterial);

    this.meshs.add(this.clonedMesh);

    // 计算每段测距线累加的总距离
    let allLength = this.dottingLabels.reduce((sumNum, cur) => {
      return sumNum + +cur.text.match(/[0-9]+.[0-9]+/)[0];
    }, 0);

    // 增加标签
    let texLabel = new LengthLabel(
      this.closedPath.v1.clone().lerp(this.closedPath.v2, 0.5),
      `总长度 ${allLength.toFixed(2)}${this.unit} <br />
       直线距离 ${(this.closedPath.v1.distanceTo(this.closedPath.v2) * this.plottingScale).toFixed(
         2,
       )} ${this.unit}
    `,
    );
    this.meshs.add(texLabel.label);
    this.dottingLabels.push(texLabel);
  }

  // 清理废弃变量
  clearDiscardVariable() {
    /**
     * @清空无用变量 也就是path、geometry、material等，仅保留展示用的mesh
     * @注意 path和vector3无明确的销毁方法 推测只要清理掉引用，就会被浏览器GC机制回收掉
     */

    /**@清空测距线上无需展示的变量 */
    this.dottingPositions = null;
    this.distencePath = null;
    this.distenceGeometry?.dispose();
    this.distenceTubeMaterial?.dispose();

    /**@清空标准球体模型 */
    this.standerSphereGeometry?.dispose();
    this.dottingdSphere.material?.dispose();
    this.dottingdSphere?.removeFromParent();

    /**@清空闭合管道变量 */

    this.closedPath = null;
    this.closedMaterial?.dispose();
    this.closedGeometry?.dispose();

    /**@清空预选区变量 */

    // 清空预备点
    this.readySphere.material?.dispose();
    this.readySphere?.removeFromParent();

    // 移除path引用
    this.readyPath = null;

    // 清空预备区管道的几何体、材质、网格对象
    this.readyTubeMaterial?.dispose();
    this.readyGeometry?.dispose();
    this.readyTubeMesh?.removeFromParent();

    // 删除预选区文本标签
    this.readyLabel?.destroy();
  }

  // 销毁当前测距线
  destroy() {
    // 清空测距线的tube和sphere
    this.meshs.remove(this.distenceTubeMesh);
    this.distenceTubeMesh?.removeFromParent();
    this.dottingLineSphereMesh.children.forEach(sphere => {
      this.dottingLineSphereMesh.remove(sphere);
      sphere?.removeFromParent();
    });

    this.meshs.remove(this.dottingLineSphereMesh);
    this.dottingLineSphereMesh?.removeFromParent();

    this.meshs?.removeFromParent();

    // 清空文本标签
    this.dottingLabels.forEach(lable => {
      lable.destroy();
    });

    // 清空闭合管道变量
    this.meshs.remove(this.clonedMesh);
    this.clonedMesh?.removeFromParent();
  }
}

export class AreaLine extends DistenceLine {
  constructor() {
    super();

    // 形状
    this.shape = new Shape();
  }
  // 结束打点
  endDotting() {
    // 如果有大于两个点，也就是有转折，那么连接首尾并进行统计
    // 也就是将管道进行闭合操作
    // 然后将多边形投影到XZ平面，计算面积
    if (this.dottingPositions.length > 2) {
      super.closeDottingLineTube();

      this.getPlaneFigure();
    }

    super.clearDiscardVariable();
  }

  // 根据三维坐标点投影出在XZ平面的多边形
  /**@此处投影到某个y平面 y=5 */
  getPlaneFigure() {
    let PlaneY = 5;

    let cp, np;

    for (let i = 0; i < this.dottingPositions.length; i++) {
      cp = this.dottingPositions[i];
      np = this.dottingPositions[i === this.dottingPositions.length - 1 ? 0 : i + 1];

      this.shape.add(new LineCurve(new Vector2(cp.x, cp.z), new Vector2(np.x, np.z)));
    }

    console.log(this.shape);

    let planeFigure = new Mesh(
      new ShapeGeometry(this.shape),
      new MeshStandardMaterial({ color: 0xffff00, side: DoubleSide }),
    );

    planeFigure.rotateX(-Math.PI / 2);
    planeFigure.position.set(0, 0, 0);
    // PlaneY
    console.log(planeFigure);

    this.meshs.add(planeFigure);
    console.log(planeFigure);
  }
}
