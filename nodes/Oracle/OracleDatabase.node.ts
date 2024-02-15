import { IExecuteFunctions } from "n8n-core";

import {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";
import { ConnectionAttributes } from "oracledb";
import oracledb from "oracledb";
import { OracleConnection } from "./core/connection";

export class OracleDatabase implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Oracle Database",
    name: "Oracle Database",
    icon: "file:oracle.svg",
    group: ["input"],
    version: 1,
    description: "Upsert, get, add and update data in Oracle database",
    defaults: {
      name: "Oracle Database",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "oracleCredentials",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "SQL Statement",
        name: "query",
        type: "string",
        typeOptions: {
          alwaysOpenEditWindow: true,
        },
        default: "",
        placeholder: "SELECT id, name FROM product WHERE id < :param_name",
        required: true,
        description: "The SQL query to execute",
      },
      {
        displayName: 'Parameters',
        name: 'params',
        placeholder: 'Add Parameter',
        type: 'fixedCollection',
        typeOptions: {
          multipleValueButtonText: 'Add another Parameter',
          multipleValues: true,
        },
        default: {},
        options: [
          {
            displayName: 'Values',
            name: 'values',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
                placeholder: 'e.g. param_name',
                required: true,
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                placeholder: 'e.g. 12345',
                required: true,
              },
            ],
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials("oracleCredentials");
    const oracleCredentials = {
      user: String(credentials.user),
      password: String(credentials.password),
      connectionString: String(credentials.connectionString),
    };

    const db = new OracleConnection(
      oracleCredentials,
      Boolean(credentials.thinMode)
    );
    const connection = await db.getConnection();

    let returnItems = [];

    try {
      //get parameter list:
      const parameterIDataObjectList = ((this.getNodeParameter('params', 0, {}) as IDataObject).values as {[key: string]: string }[]) || [];
      const parameterMap: { [key: string]: string } = parameterIDataObjectList.reduce((result, item) => {
        result[item.name] = item.value;
        return result;
      }, {});
    
      //get query
      const query = this.getNodeParameter("query", 0) as string;

      //execute query
      const result = await connection.execute(query, parameterMap, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      returnItems = this.helpers.returnJsonArray(
        result as unknown as IDataObject[]
      );
    } catch (error) {
      throw new NodeOperationError(this.getNode(), error.message);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error(
            `OracleDB: Failed to close the database connection: ${error}`
          );
        }
      }
    }

    return this.prepareOutputData(returnItems);
  }
}
