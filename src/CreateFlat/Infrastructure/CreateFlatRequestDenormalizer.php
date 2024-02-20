<?php

declare(strict_types=1);

namespace App\CreateFlat\Infrastructure;

use App\CreateFlat\UI\Controller\CreateFlatDto;
use App\CreateFlat\UI\Controller\CreateRoomDto;
use App\Shared\Infrastructure\Exception\HttpRequestValidationException;
use Ds\Map;
use Ds\Vector;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final readonly class CreateFlatRequestDenormalizer implements DenormalizerInterface
{
    public function __construct(private ValidatorInterface $validator)
    {
    }

    public function denormalize(
        mixed $data,
        string $type,
        ?string $format = null,
        array $context = [],
    ): CreateFlatDto {
        if (false === is_array($data)) {
            throw new \InvalidArgumentException('CreateFlatRequest denormalization data should be passed as array');
        }

        $mapData = new Map($data);

        $constraint = new Assert\Collection(
            [
                'id' => new Assert\Ulid(),
                'address' => new Assert\Collection(
                    [
                        'city' => [new Assert\NotBlank(), new Assert\Length(255)],
                        'street' => [new Assert\NotBlank(), new Assert\Length(255)],
                        'zipCode' => [new Assert\NotBlank(), new Assert\Length(255)],

                    ]
                )
            ]
        );

        $validationResult = $this->validator->validate($constraint);

        if (count($validationResult > 0)) {
            throw HttpRequestValidationException::fromError($validationResult);
        }

        $rooms = (new Vector($mapData->get('rooms')))
            ->map(
                static fn(array $room): CreateRoomDto => new CreateRoomDto($room['roomName'], $room['roomType'])
            );

        return new CreateFlatDto(
            $mapData->get('ownerId'),
            $mapData->get('address'),
            $mapData->get('zipCode'),
            $rooms,
        );
    }

    public function supportsDenormalization(
        mixed $data,
        string $type,
        ?string $format = null,
        array $context = [],
    ): bool {
        return false;
//        return $type === CreateFlatRequest::class;
    }

    public function getSupportedTypes(?string $format): array
    {
        return [];
//        return [CreateFlatRequest::class => true];
    }
}
