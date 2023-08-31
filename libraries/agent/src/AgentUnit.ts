import {
  AccountSimulatorUnit,
  BasicUnit,
  DataLoadingTaskUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  SeriesDataUnit,
} from '@yuants/kernel';
import { OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import {
  useAccountInfo,
  useEffect,
  useExchange,
  useLog,
  useMemo,
  useMemoAsync,
  useOHLC,
  useParamBoolean,
  useParamNumber,
  useParamOHLC,
  useParamProduct,
  useParamString,
  useProduct,
  useRecordTable,
  useRef,
  useSeries,
  useSinglePosition,
  useState,
} from './hooks';

/**
 * 模型单元
 * @public
 */
export class AgentUnit extends BasicUnit {
  static currentAgent: AgentUnit | null = null;
  orderMatchingUnit: OrderMatchingUnit;
  productDataUnit: ProductDataUnit;
  productLoadingUnit?: ProductLoadingUnit;
  dataLoadingTaskUnit: DataLoadingTaskUnit;
  periodDataUnit: PeriodDataUnit;
  accountInfoUnit: AccountSimulatorUnit;
  seriesDataUnit: SeriesDataUnit;

  /**
   * @param kernel - 内核
   * @param script - 初始化脚本 (IIFE, 执行后返回值为函数)
   */
  constructor(
    public kernel: Kernel,
    public script: string,
    public params: Record<string, any>,
    public options: { start_time: number; end_time: number },
  ) {
    super(kernel);
    this.accountInfoUnit = kernel.units.find(
      (unit): unit is AccountSimulatorUnit => unit instanceof AccountSimulatorUnit,
    )!;
    this.orderMatchingUnit = kernel.units.find(
      (unit): unit is OrderMatchingUnit => unit instanceof OrderMatchingUnit,
    )!;
    this.productDataUnit = kernel.units.find(
      (unit): unit is ProductDataUnit => unit instanceof ProductDataUnit,
    )!;

    this.seriesDataUnit = kernel.units.find(
      (unit): unit is SeriesDataUnit => unit instanceof SeriesDataUnit,
    )!;

    this.productLoadingUnit = kernel.units.find(
      (unit): unit is ProductLoadingUnit => unit instanceof ProductLoadingUnit,
    );
    this.periodDataUnit = kernel.units.find(
      (unit): unit is PeriodDataUnit => unit instanceof PeriodDataUnit,
    )!;

    // TODO: load product using DataLoadingTaskUnit
    this.dataLoadingTaskUnit = kernel.units.find(
      (unit): unit is DataLoadingTaskUnit => unit instanceof DataLoadingTaskUnit,
    )!;

    this.runScript = makeScriptRunner(script);
  }

  private runScript: () => any;

  private _hooks: Array<{ current: any }> = [];
  private _hookIdx = 0;

  useRef = <T>(initialValue: T): { current: T } =>
    (this._hooks[this._hookIdx++] ??= { current: initialValue });

  execute() {
    AgentUnit.currentAgent = this;
    this._hookIdx = 0;
    return this.runScript();
  }

  onEvent(): void | Promise<void> {
    return this.execute();
  }

  paramsSchema: JSONSchema7 = { type: 'object', properties: {} };

  record_table: Record<string, Record<string, any>[]> = {};
}

function makeScriptRunner(script: string): () => any {
  const globalContext = {
    PositionVariant,
    OrderDirection,
    OrderType,
    useRef,
    useEffect,
    useMemo,
    useMemoAsync,
    useAccountInfo,
    useLog,
    useParamString,
    useParamNumber,
    useParamBoolean,
    useParamProduct,
    useParamOHLC,
    useProduct,
    useOHLC,
    useRecordTable,
    useSinglePosition,
    useExchange,
    useSeries,
    useState,
  };

  const x = Object.entries(globalContext);

  const module = new Function(...x.map((x) => x[0]), `return ${script}`)(...x.map((x) => x[1]));
  if (module.__esModule) {
    if (typeof module.default === 'function') {
      return module.default;
    }
    throw new Error(`Module must export default function`);
  }
  if (typeof module !== 'function') {
    throw new Error('Module must export default function');
  }
  return module;
}