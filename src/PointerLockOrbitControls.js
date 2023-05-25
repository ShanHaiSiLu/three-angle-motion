import { Spherical, Quaternion, Vector2, Vector3, EventDispatcher } from "three";

export class PointerLockOrbitControls extends EventDispatcher {
  // 当前是否是锁定状态
  isLocked = false;

  // 坐标中心，也就是轨道的中心，也就是player
  target;

  // 滑动鼠标时的旋转速度
  rotateSpeed = 1.0;
  // 滚动滚轮时的缩放速度
  zoomScaleSpeed = 0.95;

  // 被控制的相机
  object;

  // 控制用的DOM
  domElement;

  // 球坐标半径的限制（默认仅使用透视相机）
  minDistance = 0;
  maxDistance = Infinity;

  // 垂直轨道的距离，上限和下限
  // 从0到Math.PI弧度制角
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;

  // 使用弧度制夹角表示的水平轨道夹角的上限和下限
  // 如果设置了区间[min, max]必须是[-2*PI, 2*PI]的子区间，其中(max - min < 2 PI)
  minAzimuthAngle = -Infinity;
  maxAzimuthAngle = Infinity;

  // 球坐标中的当前位置，球坐标变动值
  #spherical = new Spherical();
  #sphericalDelta = new Spherical();

  // 缩放量
  #zoomScale = 1;

  // 创建球坐标时保存的quat的共轭四元数（翻转四元数、反向四元数）
  #quatInverse;

  // 偏移量，用来给球坐标和轴坐标的转换做中间值
  #offset = new Vector3();

  // 滑动鼠标旋转时，将鼠标的屏幕移动量xy转化为角度用的中间变量
  #rotateDelta = new Vector2();

  constructor(object, domElement, target) {
    super();

    if (!object?.isPerspectiveCamera) {
      return console.error(
        "指针锁定轨道控制器创建失败：构造函数的参数一不是透视相机（PerspectiveCamera）！",
      );
    }
    if (!domElement instanceof HTMLElement || domElement.tagName !== "CANVAS") {
      return console.error(
        "指针锁定轨道控制器创建失败：构造函数的参数二不是一个合法的canvas元素！",
      );
    }
    if (!target?.isVector3) {
      return console.error("指针锁定轨道控制器创建失败：构造函数的参数三不是三维向量（Vector3）！");
    }

    this.object = object;
    this.domElement = domElement;
    this.target = target;

    this.#connect();
  }

  #connect() {
    // DOM的指针锁定回调
    this.domElement.ownerDocument.addEventListener("pointerlockchange", this.#onPointerlockChange);

    /**
     * 监听滚轮的滚动事件，修改球坐标的r
     * 监听鼠标的移动事件，更新球坐标的φθ
     * 在轨道控制器中这两个事件都是在按下按键后触发，所以统一通过switch分发事件处理
     * 此处直接分开处理即可，且无需处理左键和右键的按下移动事件
     */
    this.domElement.ownerDocument.addEventListener("pointermove", this.#onPointerMove);

    this.domElement.ownerDocument.addEventListener("wheel", this.#onMouseWheel, { passive: false });
  }

  #onPointerlockChange = () => {
    if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
      // 进入锁定
      this.dispatchEvent({ type: "lock" });
      this.isLocked = true;

      this.#createOribit();
    } else {
      // 解除锁定
      this.dispatchEvent({ type: "unlock" });
      this.isLocked = false;
    }
  };

  // 鼠标移动事件，根据移动量xy更新sphericalDelta的φθ
  // 依据sphericalDelta更新spherical，依据spherical更新camra.position
  #onPointerMove = e => {
    // 默认e.pointerType为mouse，也就是在PC上进行操作；
    // e.pointerType为touch的手机事件暂时忽略

    if (!this.isLocked) return;

    // 偏移量重置
    this.#offset = new Vector3();

    // 根据鼠标滑动距离更新sphericalDelta
    this.#rotateDelta.set(e.movementX, e.movementY).multiplyScalar(this.rotateSpeed);

    this.#rotateLeft((2 * Math.PI * this.#rotateDelta.x) / this.domElement.clientHeight);
    this.#rotateUp((2 * Math.PI * this.#rotateDelta.y) / this.domElement.clientHeight);
  };

  // 监听鼠标的滚轮事件，更新球坐标的r
  #onMouseWheel = e => {
    if (!this.isLocked) return;

    // 更新球坐标的r
    if (e.deltaY < 0) {
      this.#zoomScale = this.zoomScaleSpeed;
    } else {
      this.#zoomScale = 1 / this.zoomScaleSpeed;
    }
  };

  // 滑动鼠标时，左右移动的距离映射为角度后，设定为修改θ的角度（绕y轴旋转的角度）
  #rotateLeft = angle => {
    this.#sphericalDelta.theta -= angle;
  };
  // 滑动鼠标时，上下移动的距离映射为角度后，设定为修改φ的角度
  #rotateUp = angle => {
    this.#sphericalDelta.phi -= angle;
  };

  //创建轨道，也就是一个球坐标系，将xyz的轴坐标记录为rφθ的球坐标
  #createOribit = () => {
    // 计算摄像机的up与y轴正方向的差值（大多数时候都是{ x: 0, y: 0, z: 0, w: 1 }）
    const quat = new Quaternion().setFromUnitVectors(this.object.up, new Vector3(0, 1, 0));
    this.#quatInverse = quat.clone().invert();

    this.#offset.copy(this.object.position).sub(this.target);
    this.#offset.applyQuaternion(quat);
    this.#spherical.setFromVector3(this.#offset);
  };

  // 更新控制器的方法，将鼠标滑动和滚轮滚动产生的变化更新到相机上
  // 根据球坐标偏移更新球坐标，然后更新摄像机的轴坐标
  update() {
    // 根据sphericalDelta更新spherical
    this.#spherical.theta += this.#sphericalDelta.theta;
    this.#spherical.phi += this.#sphericalDelta.phi;

    // 将值限制在极值区间内
    // 水平夹角限制
    if (isFinite(this.minAzimuthAngle) && isFinite(this.maxAzimuthAngle)) {
      // 极值有效性验证
      if (this.minAzimuthAngle < -Math.PI) this.minAzimuthAngle += Math.PI * 2;
      else if (this.minAzimuthAngle > Math.PI) this.minAzimuthAngle -= Math.PI * 2;

      if (this.maxAzimuthAngle < -Math.PI) this.maxAzimuthAngle += Math.PI * 2;
      else if (this.maxAzimuthAngle > Math.PI) this.maxAzimuthAngle -= Math.PI * 2;

      // 通过极值区间进行大小限制
      if (this.minAzimuthAngle < this.maxAzimuthAngle) {
        this.#spherical.theta = Math.max(
          this.minAzimuthAngle,
          Math.min(this.maxAzimuthAngle, this.#spherical.theta),
        );
      } else {
        this.#spherical.theta =
          this.#spherical.theta > (this.minAzimuthAngle + this.maxAzimuthAngle) / 2
            ? Math.max(this.minAzimuthAngle, this.#spherical.theta)
            : Math.min(this.maxAzimuthAngle, this.#spherical.theta);
      }
    }

    // 垂直夹角限制
    this.#spherical.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this.#spherical.phi),
    );

    // 根据zoomScale更新球坐标的r
    this.#spherical.radius *= this.#zoomScale;
    // 半径大小限制
    this.#spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.#spherical.radius),
    );

    // 防止角度死锁，否则会在跨越(0,1,0)和(0,-1,0)是发生xz轴的反转
    this.#spherical.makeSafe();

    // 将球坐标转化为轴坐标
    this.#offset.setFromSpherical(this.#spherical);

    // 将偏移量旋转回"camera-up-vector-up"
    // this.#offset.applyQuaternion(this.#quatInverse);

    // 根据target和offset移动相机
    this.object.position.copy(this.target).add(this.#offset);
    this.object.lookAt(this.target);

    // 重置球坐标偏移量和缩放量
    this.#sphericalDelta.set(0, 0, 0);
    this.#zoomScale = 1;
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    this.domElement.ownerDocument.exitPointerLock();
  }

  getAzimuthalAngle() {
    return this.#spherical.theta;
  }

  setZoomTo0() {
    this.#zoomScale = 0;
  }
}
