<?php

declare(strict_types=1);

namespace App\CreateFlat\UI\Controller;

use App\CreateFlat\Application\CreateFlatCommand;
use App\CreateFlat\Domain\Flat\FlatId;
use App\CreateFlat\Domain\User\UserId;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateFlatController extends AbstractController
{
    public function __invoke(MessageBusInterface $bus, Request $request): JsonResponse
    {


        $bus->dispatch(new CreateFlatCommand(FlatId::create(), UserId::create()));

        return new JsonResponse(['id' => $flatId], Response::HTTP_CREATED);
    }
}
