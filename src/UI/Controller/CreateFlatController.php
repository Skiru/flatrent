<?php

declare(strict_types=1);

namespace App\UI\Controller;

use App\Application\CreateFlat\CreateFlatCommand;
use App\Domain\Flat\FlatId;
use App\Domain\User\UserId;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateFlatController extends AbstractController
{
    public function __invoke(MessageBusInterface $bus): JsonResponse
    {
        $command = new CreateFlatCommand(FlatId::create(), UserId::create());

        $bus->dispatch($command);

        return new JsonResponse(['data']);
    }
}
