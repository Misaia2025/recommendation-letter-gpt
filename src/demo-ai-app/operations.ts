import * as z from 'zod'
import type { Task, GptResponse } from 'wasp/entities'
import type {
  GenerateGptResponse,
  CreateTask,
  DeleteTask,
  UpdateTask,
  GetGptResponses,
  GetAllTasksByUser,
} from 'wasp/server/operations'
import { HttpError } from 'wasp/server'
import OpenAI from 'openai'
import { SubscriptionStatus } from '../payment/plans'
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation'

/** Inicialización de OpenAI */
const openai = setupOpenAI()
function setupOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return new HttpError(500, 'OpenAI API key is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

//#region Actions

/** Esquema de entrada: ahora recibimos un prompt de texto */
const generateGptResponseInputSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
})
type GenerateGptResponseInput = z.infer<typeof generateGptResponseInputSchema>
/** Esquema de salida: devolvemos sólo el texto */
type GenerateGptResponseOutput = { text: string }

/**
 * Acción generateGptResponse
 * Recibe { prompt } y devuelve { text }
 */
export const generateGptResponse: GenerateGptResponse<
  GenerateGptResponseInput,
  GenerateGptResponseOutput
> = async (rawArgs, context) => {
  // 1) Autorización
  if (!context.user) {
    throw new HttpError(401)
  }

  // 2) Validar input
  const { prompt } = ensureArgsSchemaOrThrowHttpError(
    generateGptResponseInputSchema,
    rawArgs
  )

  // 3) Verificar créditos/suscripción
  if (openai instanceof Error) {
    throw openai
  }
  const hasCredits = context.user.credits > 0
  const hasValidSubscription =
    !!context.user.subscriptionStatus &&
    context.user.subscriptionStatus !== SubscriptionStatus.Deleted &&
    context.user.subscriptionStatus !== SubscriptionStatus.PastDue
  const canUserContinue = hasCredits || hasValidSubscription
  if (!canUserContinue) {
    throw new HttpError(402, 'User has not paid or is out of credits')
  }
  // Decrementar un crédito
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { credits: { decrement: 1 } },
  })

  // 4) Llamar a OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  })
  const text = completion.choices?.[0]?.message?.content ?? ''

  // 5) Persistir respuesta en BD
  await context.entities.GptResponse.create({
    data: {
      user: { connect: { id: context.user.id } },
      content: text,
    },
  })

  // 6) Devolver sólo el texto
  return { text }
}

//#endregion

/** --- El resto de tu archivo permanece igual --- */

const createTaskInputSchema = z.object({
  description: z.string().nonempty(),
})

type CreateTaskInput = z.infer<typeof createTaskInputSchema>

export const createTask: CreateTask<CreateTaskInput, Task> = async (
  rawArgs,
  context
) => {
  if (!context.user) {
    throw new HttpError(401)
  }

  const { description } = ensureArgsSchemaOrThrowHttpError(
    createTaskInputSchema,
    rawArgs
  )

  const task = await context.entities.Task.create({
    data: {
      description,
      user: { connect: { id: context.user.id } },
    },
  })

  return task
}

const updateTaskInputSchema = z.object({
  id: z.string().nonempty(),
  isDone: z.boolean().optional(),
  time: z.string().optional(),
})

type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>

export const updateTask: UpdateTask<UpdateTaskInput, Task> = async (
  rawArgs,
  context
) => {
  if (!context.user) {
    throw new HttpError(401)
  }

  const { id, isDone, time } = ensureArgsSchemaOrThrowHttpError(
    updateTaskInputSchema,
    rawArgs
  )

  const task = await context.entities.Task.update({
    where: {
      id,
      user: {
        id: context.user.id,
      },
    },
    data: {
      isDone,
      time,
    },
  })

  return task
}

const deleteTaskInputSchema = z.object({
  id: z.string().nonempty(),
})

type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>

export const deleteTask: DeleteTask<DeleteTaskInput, Task> = async (
  rawArgs,
  context
) => {
  if (!context.user) {
    throw new HttpError(401)
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    deleteTaskInputSchema,
    rawArgs
  )

  const task = await context.entities.Task.delete({
    where: {
      id,
      user: {
        id: context.user.id,
      },
    },
  })

  return task
}

//#region Queries

export const getGptResponses: GetGptResponses<void, GptResponse[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401)
  }
  return context.entities.GptResponse.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
  })
}

export const getAllTasksByUser: GetAllTasksByUser<void, Task[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401)
  }
  return context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

//#endregion
